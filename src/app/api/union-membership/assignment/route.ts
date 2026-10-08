import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { assignmentSchema } from "@/modules/union-membership/schemas";

export async function POST(request: Request) {
  try {
    const input = assignmentSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data: actorRole } = await supabase.from("role_grants").select("role_code, organization_id")
      .eq("id", input.roleGrantId).eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").is("revoked_at", null).maybeSingle();
    if (!actorRole || !["school_admin", "office", "committee_manager"].includes(actorRole.role_code)) {
      throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền phân công hồ sơ.");
    }
    const { data, error } = await supabase.rpc("assign_membership_application", {
      p_application_id: input.applicationId,
      p_collaborator_user_id: input.collaboratorUserId,
      p_organization_id: input.organizationId,
      p_role_grant_id: input.roleGrantId,
    });
    if (error) throw new HttpError(422, "ASSIGNMENT_FAILED", "CTV phải có vai trò hợp lệ trong đúng Ban.");
    return NextResponse.json({ id: data, message: "Đã phân công CTV." });
  } catch (error) {
    return apiError(error);
  }
}
