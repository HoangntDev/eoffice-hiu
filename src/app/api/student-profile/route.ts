import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { studentProfileSchema } from "@/modules/student-profile/schemas";

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const [{ data: account }, { data: email }, { data: profile, error }] = await Promise.all([
      supabase.from("accounts").select("student_code, status").eq("user_id", user.id).single(),
      supabase.from("account_emails").select("email, verified_at").eq("user_id", user.id).single(),
      supabase.from("student_profiles").select("full_name, gender, phone, class_id, completed_at, updated_at")
        .eq("user_id", user.id).maybeSingle(),
    ]);
    if (error) throw new Error("PROFILE_READ_FAILED");
    return NextResponse.json({ account, email, profile });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const input = studentProfileSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_student_profile", {
      p_full_name: input.fullName,
      p_gender: input.gender,
      p_phone: input.phone,
      p_class_id: input.classId,
    });
    if (error) {
      if (error.message.includes("INVALID_OR_INACTIVE_CLASS")) {
        throw new HttpError(422, "INVALID_CLASS", "Lớp đã chọn không còn hợp lệ.");
      }
      throw new Error("PROFILE_SAVE_FAILED");
    }
    return NextResponse.json({ profile: data, message: "Đã lưu hồ sơ sinh viên." });
  } catch (error) {
    return apiError(error);
  }
}
