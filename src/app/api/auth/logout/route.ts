import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { EXPIRED_COOKIE, isSupabaseAuthCookie } from "@/lib/auth/session-cookies";
import { logEvent, requestIdFrom } from "@/lib/log";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";

// Auth không trả lời thì không chờ mãi: cookie vẫn bị xóa và người dùng vẫn rời phiên (#84).
const SIGN_OUT_TIMEOUT_MS = 3_000;

type LogoutResult = "ok" | "sign_out_failed" | "sign_out_timeout" | "officer_end_failed" | "lookup_failed";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), ms); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const supabase = await createUserSupabase();
  let next = "/login";
  let accountType: string | null = null;
  let officerSessionEnded = false;
  let result: LogoutResult = "ok";

  // Phiên tổ chức: kết thúc phiên cán bộ trước (ghi ended_at, xóa auth.sessions) như "Đổi cán bộ".
  // getClaims kiểm JWT tại chỗ nên bước này không phụ thuộc Auth server.
  try {
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    const sessionId = typeof data?.claims?.session_id === "string" ? data.claims.session_id : null;
    if (userId) {
      const admin = createAdminSupabase();
      const { data: account } = await admin.from("accounts").select("account_type").eq("user_id", userId).maybeSingle();
      accountType = (account?.account_type as string | undefined) ?? null;
      if (accountType === "organization") {
        next = "/admin/login";
        if (sessionId) {
          const { error } = await admin.rpc("end_officer_session", { p_session_id: sessionId });
          if (error) result = "officer_end_failed";
          else officerSessionEnded = true;
        }
      }
    }
  } catch {
    result = "lookup_failed";
  }

  try {
    const outcome = await withTimeout(supabase.auth.signOut({ scope: "local" }), SIGN_OUT_TIMEOUT_MS);
    if (outcome === "timeout") result = "sign_out_timeout";
    else if (outcome.error && result === "ok") result = "sign_out_failed";
  } catch {
    if (result === "ok") result = "sign_out_failed";
  }

  // Luôn xóa mọi cookie sb-* dù signOut thành công hay không: trình duyệt không được giữ phiên cũ.
  // Không trả Clear-Site-Data: header này làm Chromium giữ phản hồi rất lâu, nút kẹt "Đang đăng xuất…".
  const response = NextResponse.json({ message: "Đã đăng xuất.", next });
  for (const cookie of (await cookies()).getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) response.cookies.set(cookie.name, "", EXPIRED_COOKIE);
  }
  response.headers.set("Cache-Control", "no-store, max-age=0");
  logEvent(result === "ok" ? "info" : "warn", "auth.logout", {
    source: "auth", requestId, accountType, officerSessionEnded, result, next,
  });
  return response;
}
