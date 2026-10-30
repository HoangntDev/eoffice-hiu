// SPIKE CR-01-TaiKhoanToChuc (#37): bước 2 đăng nhập tổ chức (MSSV + PIN cá nhân của cán bộ). Không merge.
import { NextResponse } from "next/server";
import { apiError, HttpError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  clearPendingLogin, GENERIC_ORG_MESSAGE, pendingLoginId, sessionIdOf, verifyPersonalPin,
} from "@/lib/auth/organization-login";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { officerLoginSchema } from "@/modules/auth-account/schemas";

const fail = () => new HttpError(401, "INVALID_CREDENTIALS", GENERIC_ORG_MESSAGE);

export async function POST(request: Request) {
  try {
    const input = officerLoginSchema.parse(await readJson(request));
    const limiter = await enforceAuthRateLimit(request, "login", input.studentCode);
    const admin = createAdminSupabase();

    const challengeId = await pendingLoginId();
    const { data: orgAccount } = challengeId
      ? await admin.rpc("read_organization_login", { p_challenge_id: challengeId, p_consume: false })
      : { data: null };
    if (!orgAccount) throw fail(); // hết 5 phút hoặc chưa qua bước 1

    const { data: officer } = await admin.from("accounts").select("user_id, status")
      .eq("student_code", input.studentCode).eq("account_type", "student").maybeSingle();
    const { data: mapping } = officer?.status === "active"
      ? await admin.from("account_emails").select("email, verified_at").eq("user_id", officer.user_id).maybeSingle()
      : { data: null };
    const pinOk = mapping?.email && mapping.verified_at ? await verifyPersonalPin(mapping.email, input.pin) : false;
    await limiter.record(pinOk);
    if (!officer || !pinOk) throw fail();

    const { data: memberId } = await admin.rpc("organization_member_for", {
      p_account_user_id: orgAccount, p_officer_user_id: officer.user_id,
    });
    if (!memberId) throw fail();
    const { data: consumed } = await admin.rpc("read_organization_login", { p_challenge_id: challengeId, p_consume: true });
    if (consumed !== orgAccount) throw fail();

    // Phiên Auth của tài khoản tổ chức: server tạo bằng magic link (mật khẩu Auth của tài khoản tổ chức là ngẫu nhiên).
    const { data: orgUser } = await admin.auth.admin.getUserById(orgAccount as string);
    const { data: link } = orgUser.user?.email
      ? await admin.auth.admin.generateLink({ type: "magiclink", email: orgUser.user.email })
      : { data: null };
    const supabase = await createUserSupabase();
    const { data: verified } = link?.properties?.hashed_token
      ? await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" })
      : { data: null };
    const sessionId = verified?.session ? sessionIdOf(verified.session.access_token) : null;
    if (!sessionId) throw fail();

    const { error } = await admin.rpc("start_officer_session", {
      p_session_id: sessionId, p_account_user_id: orgAccount, p_officer_user_id: officer.user_id,
    });
    if (error) {
      await supabase.auth.signOut({ scope: "local" });
      throw fail();
    }
    await clearPendingLogin();
    return NextResponse.json({ message: "Đăng nhập tổ chức thành công.", next: "/admin" });
  } catch (error) {
    return apiError(error);
  }
}
