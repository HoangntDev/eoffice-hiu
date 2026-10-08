import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { saveTemplateSchema } from "@/modules/forms/schemas";

export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("form_templates")
      .select("id, title, description, audience_rule, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error("LIST_TEMPLATES_FAILED");
    return NextResponse.json({ templates: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = saveTemplateSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_form_template", {
      p_id:            input.id ?? null,
      p_title:         input.title,
      p_description:   input.description ?? null,
      p_audience_rule: input.audience_rule,
      p_questions:     input.questions,
      p_status:        input.status,
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) throw new HttpError(403, "FORBIDDEN", "Chỉ Đoàn Trường được quản lý thư viện mẫu.");
      throw new HttpError(422, "SAVE_TEMPLATE_FAILED", error.message);
    }
    return NextResponse.json({ id: data }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
