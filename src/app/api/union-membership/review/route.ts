import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { reviewSchema } from "@/modules/union-membership/schemas";

async function requireReviewerRole(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, roleGrantId?: string) {
  let query = supabase.from("role_grants").select("id, role_code, organization_id")
    .eq("user_id", userId).is("revoked_at", null);
  if (roleGrantId) query = query.eq("id", roleGrantId);
  const { data, error } = await query;
  const allowed = data?.some((role) => ["school_admin", "office", "collaborator"].includes(role.role_code));
  if (error || !allowed) throw new HttpError(403, "FORBIDDEN", "Bạn không có vai trò xử lý hồ sơ.");
  return data ?? [];
}

export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    await requireReviewerRole(supabase, user.id);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const { data: canAccess } = await supabase.rpc("can_access_application", { p_application_id: id });
      if (!canAccess) throw new HttpError(403, "FORBIDDEN", "Hồ sơ không thuộc phạm vi xử lý.");
      const [{ data: application }, { data: identity }, { data: membership }, { data: qualifications }, { data: checks }, { data: checklistItems }] = await Promise.all([
        supabase.from("union_applications").select("*").eq("id", id).single(),
        supabase.from("union_identity_details").select("*").eq("application_id", id).single(),
        supabase.from("union_membership_details").select("*").eq("application_id", id).single(),
        supabase.from("union_qualification_details").select("*").eq("application_id", id).single(),
        supabase.from("membership_application_checks").select("*").eq("application_id", id),
        supabase.from("membership_review_checklist_items").select("id,code,label,is_required,display_order").eq("is_active",true).order("display_order"),
      ]);
      return NextResponse.json({ application, identity, membership, qualifications, checks: checks ?? [], checklistItems: checklistItems ?? [] });
    }

    const { data, error } = await supabase.from("union_applications")
      .select("id, user_id, cycle_key, status, submitted_at, profile_snapshot, organization_snapshot, updated_at")
      .not("status", "in", "(draft,recognized,rejected)")
      .order("submitted_at", { ascending: true });
    if (error) throw new Error("REVIEW_QUEUE_FAILED");
    return NextResponse.json({ applications: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = reviewSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    await requireReviewerRole(supabase, user.id, input.roleGrantId);
    const { data, error } = await supabase.rpc("review_union_application", {
      p_application_id: input.applicationId,
      p_outcome: input.outcome,
      p_reason: input.reason,
      p_role_grant_id: input.roleGrantId,
    });
    if (error) {
      const message = error.message.includes("PAPER_BOOK_NOT_RECEIVED")
        ? "Chưa thể công nhận trước khi Văn phòng tiếp nhận Sổ Đoàn."
        : error.message.includes("COLLABORATOR_CANNOT_FINALIZE")
          ? "CTV chỉ được kiểm tra và đề xuất, không được duyệt cuối."
          : "Không thể ghi nhận kết quả xử lý.";
      throw new HttpError(422, "REVIEW_FAILED", message);
    }
    return NextResponse.json({ status: data, message: "Đã ghi nhận kết quả xử lý." });
  } catch (error) {
    return apiError(error);
  }
}
