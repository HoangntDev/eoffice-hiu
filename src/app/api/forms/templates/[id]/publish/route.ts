import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { publishTemplateVersionSchema } from "@/modules/forms/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = publishTemplateVersionSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("publish_form_template_version", {
      p_template_id: id,
      p_questions:   input.questions,
      p_notes:       input.notes ?? null,
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) throw new HttpError(403, "FORBIDDEN", "Chỉ Đoàn Trường được phát hành mẫu.");
      if (error.message.includes("TEMPLATE_NOT_FOUND")) throw new HttpError(404, "TEMPLATE_NOT_FOUND", "Mẫu không tồn tại.");
      throw new HttpError(422, "PUBLISH_VERSION_FAILED", error.message);
    }
    return NextResponse.json({ version_id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
