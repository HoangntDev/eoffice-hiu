import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { unionApplicationSchema } from "@/modules/union-membership/schemas";

export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const cycleKey = new URL(request.url).searchParams.get("cycle") ?? "2026-2027";
    const { data: application, error } = await supabase.from("union_applications")
      .select("id, cycle_key, status, submitted_at, decided_at, decision_reason, profile_snapshot, organization_snapshot, updated_at")
      .eq("user_id", user.id).eq("cycle_key", cycleKey).maybeSingle();
    if (error) throw new Error("APPLICATION_READ_FAILED");

    if (!application) return NextResponse.json({ application: null });

    const [{ data: identity }, { data: membership }, { data: qualifications }] = await Promise.all([
      supabase.from("union_identity_details").select("*").eq("application_id", application.id).maybeSingle(),
      supabase.from("union_membership_details").select("*").eq("application_id", application.id).maybeSingle(),
      supabase.from("union_qualification_details").select("*").eq("application_id", application.id).maybeSingle(),
    ]);
    return NextResponse.json({ application, identity, membership, qualifications });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const input = unionApplicationSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const payload = {
      identity: input.identity,
      membership: input.membership,
      qualifications: input.qualifications,
    };
    const { data, error } = await supabase.rpc("save_union_application", {
      p_cycle_key: input.cycleKey,
      p_payload: payload,
      p_submit: input.submit,
    });
    if (error) {
      const known = error.message.includes("BASIC_PROFILE_OR_VERIFIED_GMAIL_REQUIRED")
        ? "Hãy hoàn tất hồ sơ sinh viên và xác minh Gmail trước khi nộp."
        : error.message.includes("APPLICATION_NOT_EDITABLE")
          ? "Hồ sơ đang được xử lý nên chưa thể sửa."
          : "Không thể lưu hồ sơ. Hãy kiểm tra các trường bắt buộc và danh mục.";
      throw new HttpError(422, "APPLICATION_SAVE_FAILED", known);
    }
    return NextResponse.json({ id: data, message: input.submit ? "Đã nộp hồ sơ Đoàn viên." : "Đã lưu bản nháp." });
  } catch (error) {
    return apiError(error);
  }
}
