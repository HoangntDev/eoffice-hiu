// SPIKE CR-01-TaiKhoanToChuc (#37): đăng nhập tổ chức. Không merge.
import { NextResponse } from "next/server";
import { apiError, HttpError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { organizationLoginSchema } from "@/modules/auth-account/schemas";

const GENERIC_MESSAGE = "Không thể đăng nhập tài khoản tổ chức. Kiểm tra lại đơn vị, PIN tổ chức, MSSV và PIN cá nhân.";

function sessionIdOf(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const input = organizationLoginSchema.parse(await readJson(request));
    // PIN tổ chức: 5 lần sai / 15 phút theo đơn vị + IP. PIN cá nhân: giới hạn đăng nhập hiện có.
    const orgLimiter = await enforceAuthRateLimit(request, "org_login", input.organizationId);
    const personalLimiter = await enforceAuthRateLimit(request, "login", input.studentCode);
    const admin = createAdminSupabase();

    const { data: pinOk } = await admin.rpc("verify_organization_pin", {
      p_organization_id: input.organizationId,
      p_pin: input.organizationPin,
    });
    if (pinOk !== true) {
      await orgLimiter.record(false);
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_MESSAGE);
    }

    const { data: account } = await admin
      .from("accounts").select("user_id, status").eq("student_code", input.studentCode).maybeSingle();
    const { data: mapping } = account?.user_id && account.status === "active"
      ? await admin.from("account_emails").select("email, verified_at").eq("user_id", account.user_id).maybeSingle()
      : { data: null };
    if (!account || !mapping?.email || !mapping.verified_at) {
      await personalLimiter.record(false);
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_MESSAGE);
    }

    const supabase = await createUserSupabase();
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email: mapping.email, password: input.pin });
    await personalLimiter.record(!error);
    const sessionId = signIn?.session ? sessionIdOf(signIn.session.access_token) : null;
    if (error || !sessionId) throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_MESSAGE);

    const { error: startError } = await admin.rpc("start_organization_session", {
      p_session_id: sessionId,
      p_organization_id: input.organizationId,
      p_staff_user_id: account.user_id,
    });
    if (startError) {
      await supabase.auth.signOut();
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_MESSAGE);
    }
    await orgLimiter.record(true);
    return NextResponse.json({ message: "Đăng nhập tổ chức thành công.", next: "/admin" });
  } catch (error) {
    return apiError(error);
  }
}
