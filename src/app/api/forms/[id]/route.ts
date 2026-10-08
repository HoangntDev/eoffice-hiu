import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { saveFormSchema } from "@/modules/forms/schemas";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) throw new HttpError(404, "FORM_NOT_FOUND", "Biểu mẫu không tồn tại hoặc bạn không có quyền xem.");
    return NextResponse.json({ form: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    const input = saveFormSchema.parse({ ...(body as object), id });
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_form", {
      p_id:                        id,
      p_owner_org_id:              input.owner_org_id,
      p_title:                     input.title,
      p_description:               input.description ?? null,
      p_audience_rule:             input.audience_rule,
      p_questions:                 input.questions,
      p_allow_multiple:            input.allow_multiple_submissions,
      p_opens_at:                  input.opens_at ?? null,
      p_closes_at:                 input.closes_at ?? null,
      p_confirmation_message:      input.confirmation_message ?? null,
      p_template_version_id:       input.template_version_id ?? null,
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền sửa biểu mẫu này.");
      if (error.message.includes("FORM_NOT_EDITABLE")) throw new HttpError(422, "FORM_NOT_EDITABLE", "Biểu mẫu đã đóng/lưu trữ, không thể sửa.");
      if (error.message.includes("FORM_NOT_FOUND")) throw new HttpError(404, "FORM_NOT_FOUND", "Biểu mẫu không tồn tại.");
      throw new HttpError(422, "SAVE_FORM_FAILED", error.message);
    }
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
