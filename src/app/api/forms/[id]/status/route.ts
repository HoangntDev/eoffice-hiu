import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { setFormStatusSchema } from "@/modules/forms/schemas";

const transitionMessages: Record<string, string> = {
  FORM_ALREADY_ARCHIVED:            "Biểu mẫu đã được lưu trữ.",
  CLOSED_FORM_CAN_ONLY_ARCHIVE:     "Biểu mẫu đã đóng, chỉ có thể lưu trữ.",
  DRAFT_CAN_ONLY_PUBLISH_OR_ARCHIVE: "Bản nháp chỉ có thể phát hành hoặc lưu trữ.",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = setFormStatusSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("set_form_status", {
      p_form_id: id,
      p_status:  input.status,
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền thay đổi trạng thái biểu mẫu này.");
      if (error.message.includes("FORM_NOT_FOUND")) throw new HttpError(404, "FORM_NOT_FOUND", "Biểu mẫu không tồn tại.");
      const msg = Object.entries(transitionMessages).find(([k]) => error.message.includes(k))?.[1];
      throw new HttpError(422, "INVALID_STATUS_TRANSITION", msg ?? "Chuyển trạng thái không hợp lệ.");
    }
    return NextResponse.json({ status: data });
  } catch (error) {
    return apiError(error);
  }
}
