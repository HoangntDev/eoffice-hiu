import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { roleGrantSchema, roleRevokeSchema } from "@/modules/organization-catalog/schemas";

export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("role_grants")
      .select("id, user_id, role_code, organization_id, granted_at, revoked_at, reason")
      .is("revoked_at", null).order("granted_at", { ascending: false });
    if (error) throw new Error("ROLE_GRANTS_READ_FAILED");
    return NextResponse.json({ grants: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = roleGrantSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("grant_role", {
      p_user_id: input.userId,
      p_role_code: input.roleCode,
      p_organization_id: input.organizationId,
      p_reason: input.reason,
      p_actor_role_grant_id: input.actorRoleGrantId ?? null,
    });
    if (error) throw new HttpError(403, "ROLE_GRANT_FAILED", "Không thể cấp vai trò vượt phạm vi hiện có.");
    return NextResponse.json({ id: data, message: "Đã cấp vai trò." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const input = roleRevokeSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("revoke_role", {
      p_grant_id: input.grantId,
      p_reason: input.reason,
      p_actor_role_grant_id: input.actorRoleGrantId ?? null,
    });
    if (error) throw new HttpError(403, "ROLE_REVOKE_FAILED", "Không thể thu hồi vai trò này.");
    return NextResponse.json({ message: "Đã thu hồi vai trò." });
  } catch (error) {
    return apiError(error);
  }
}
