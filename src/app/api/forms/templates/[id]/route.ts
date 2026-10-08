import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { saveTemplateSchema } from "@/modules/forms/schemas";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data: template, error } = await supabase
      .from("form_templates")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !template) throw new HttpError(404, "TEMPLATE_NOT_FOUND", "Mẫu không tồn tại.");

    const { data: versions } = await supabase
      .from("form_template_versions")
      .select("id, version_number, questions, notes, published_at")
      .eq("template_id", id)
      .order("version_number", { ascending: false });

    return NextResponse.json({ template, versions: versions ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    const input = saveTemplateSchema.parse({ ...(body as object), id });
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_form_template", {
      p_id:            id,
      p_title:         input.title,
      p_description:   input.description ?? null,
      p_audience_rule: input.audience_rule,
      p_questions:     input.questions,
      p_status:        input.status,
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) throw new HttpError(403, "FORBIDDEN", "Chỉ Đoàn Trường được sửa mẫu.");
      if (error.message.includes("TEMPLATE_NOT_FOUND")) throw new HttpError(404, "TEMPLATE_NOT_FOUND", "Mẫu không tồn tại.");
      throw new HttpError(422, "SAVE_TEMPLATE_FAILED", error.message);
    }
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
