import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { changeStudentCodeSchema } from "@/modules/auth-account/schemas";

export async function PATCH(request: Request) {
  try {
    const input = changeStudentCodeSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    await requirePermission(supabase, "student_code.edit");
    const { error } = await supabase.rpc("change_student_code", {
      p_user_id: input.userId,
      p_new_student_code: input.newStudentCode,
      p_reason: input.reason,
      p_role_grant_id: input.roleGrantId ?? null,
    });
    if (error) throw new HttpError(409, "STUDENT_CODE_CHANGE_FAILED", "MSSV không hợp lệ, đã trùng hoặc không thể đổi.");
    return NextResponse.json({ message: "Đã đổi MSSV; UUID và các liên kết được giữ nguyên." });
  } catch (error) {
    return apiError(error);
  }
}
