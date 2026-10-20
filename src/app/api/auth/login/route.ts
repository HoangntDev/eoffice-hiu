import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { apiError, HttpError, readJson } from "@/lib/http";
import { safeNextPath } from "@/lib/auth/next-path";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { loginSchema } from "@/modules/auth-account/schemas";

const GENERIC_LOGIN_MESSAGE = "Không thể đăng nhập. MSSV/PIN có thể không đúng; nếu tài khoản đang chờ tạo PIN, hãy kiểm tra email sinh viên HIU.";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));
    const limiter = await enforceAuthRateLimit(request, "login", input.studentCode);
    const admin = createAdminSupabase();

    const { data: account } = await admin
      .from("accounts")
      .select("user_id, status")
      .eq("student_code", input.studentCode)
      .maybeSingle();

    let email: string | null = null;
    let emailVerified = false;
    if (account?.user_id && account.status !== "suspended") {
      const { data: mapping } = await admin
        .from("account_emails")
        .select("email, verified_at")
        .eq("user_id", account.user_id)
        .maybeSingle();
      email = mapping?.email ?? null;
      emailVerified = Boolean(mapping?.verified_at);
    }

    if (!email || !emailVerified) {
      await limiter.record(false);
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_MESSAGE);
    }

    const supabase = await createUserSupabase();
    if (account?.status === "pending_pin") {
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${appUrl()}/auth/confirm?flow=finish-signup`,
        },
      });
      await limiter.record(false);
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_MESSAGE);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: input.pin });
    await limiter.record(!error);
    if (error) throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_MESSAGE);

    return NextResponse.json({ message: "Đăng nhập thành công.", next: safeNextPath(input.next) });
  } catch (error) {
    return apiError(error);
  }
}
