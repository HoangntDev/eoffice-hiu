// SPIKE CR-01-TaiKhoanToChuc (#37): "Đổi cán bộ" — kết thúc phiên tổ chức hiện tại, về bước 2 mà không nhập lại PIN tổ chức.
import { NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/http";
import { sessionIdOf, setPendingLogin } from "@/lib/auth/organization-login";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createUserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    if (!session || !user) throw new HttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập để tiếp tục.");
    const admin = createAdminSupabase();
    const { data: account } = await admin.from("accounts").select("account_type").eq("user_id", user.id).maybeSingle();
    if (account?.account_type !== "organization") throw new HttpError(403, "FORBIDDEN", "Chỉ dùng trong phiên tổ chức.");

    const sessionId = sessionIdOf(session.access_token);
    if (sessionId) await admin.rpc("end_officer_session", { p_session_id: sessionId });
    await supabase.auth.signOut({ scope: "local" });
    const { data: challenge, error } = await admin.from("organization_login_challenges")
      .insert({ account_user_id: user.id }).select("id").single();
    if (error) throw new Error("ORG_LOGIN_CHALLENGE_FAILED");
    await setPendingLogin(challenge.id);
    return NextResponse.json({ message: "Chọn cán bộ thao tác.", next: "/admin/login/officer" });
  } catch (error) {
    return apiError(error);
  }
}
