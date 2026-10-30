// SPIKE CR-01-TaiKhoanToChuc (#37): bước 1 đăng nhập tổ chức (đơn vị + PIN tổ chức). Không merge.
import { NextResponse } from "next/server";
import { apiError, HttpError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { GENERIC_ORG_MESSAGE, setPendingLogin } from "@/lib/auth/organization-login";
import { createAdminSupabase } from "@/lib/supabase/server";
import { organizationLoginSchema } from "@/modules/auth-account/schemas";

export async function POST(request: Request) {
  try {
    const input = organizationLoginSchema.parse(await readJson(request));
    // PIN tổ chức: 5 lần sai / 15 phút theo đơn vị + IP.
    const limiter = await enforceAuthRateLimit(request, "org_login", input.organizationId);
    const admin = createAdminSupabase();
    const { data: account } = await admin.from("accounts").select("user_id")
      .eq("organization_id", input.organizationId).eq("account_type", "organization").maybeSingle();
    const { data: challengeId } = account
      ? await admin.rpc("start_organization_login", { p_account_user_id: account.user_id, p_pin: input.organizationPin })
      : { data: null };
    await limiter.record(Boolean(challengeId));
    if (!challengeId) throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_ORG_MESSAGE);
    await setPendingLogin(challengeId as string);
    return NextResponse.json({ message: "Đã xác thực đơn vị.", next: "/admin/login/officer" });
  } catch (error) {
    return apiError(error);
  }
}
