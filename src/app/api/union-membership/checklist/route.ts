import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { checklistSchema } from "@/modules/union-membership/schemas";

export async function POST(request: Request) {
  try {
    const input = checklistSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data: role } = await supabase.from("role_grants").select("role_code")
      .eq("id", input.roleGrantId).eq("user_id", user.id).is("revoked_at", null).maybeSingle();
    if (role?.role_code !== "collaborator") throw new HttpError(403, "FORBIDDEN", "Chỉ CTV được phân công mới cập nhật checklist.");
    const { error } = await supabase.rpc("save_membership_check", {
      p_application_id: input.applicationId,
      p_checklist_item_id: input.checklistItemId,
      p_checked: input.checked,
      p_note: input.note,
      p_role_grant_id: input.roleGrantId,
    });
    if (error) throw new HttpError(422, "CHECKLIST_SAVE_FAILED", "Không thể cập nhật checklist ngoài phạm vi phân công.");
    return NextResponse.json({ message: "Đã cập nhật checklist." });
  } catch (error) {
    return apiError(error);
  }
}
