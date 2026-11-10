import { NextResponse } from "next/server";
import { setPendingOrganizationLogin } from "@/lib/auth/organization-login";
import { apiError, HttpError } from "@/lib/http";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createUserSupabase();
    const { data } = await supabase.auth.getClaims();
    const accountUserId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    const sessionId = typeof data?.claims?.session_id === "string" ? data.claims.session_id : null;
    if (!accountUserId || !sessionId) throw new HttpError(401, "UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ.");

    const admin = createAdminSupabase();
    const { data: challengeId, error } = await admin.rpc("start_organization_switch", {
      p_account_user_id: accountUserId,
    });
    if (error || typeof challengeId !== "string") throw new HttpError(403, "FORBIDDEN", "Không thể đổi cán bộ.");
    const { error: endError } = await admin.rpc("end_officer_session", { p_session_id: sessionId });
    if (endError) throw endError;
    await supabase.auth.signOut({ scope: "local" });
    await setPendingOrganizationLogin(challengeId);
    return NextResponse.json({ next: "/admin/login/officer" });
  } catch (error) {
    return apiError(error);
  }
}
