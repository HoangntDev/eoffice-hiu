import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Thông tin hồ sơ dùng để điền sẵn câu hỏi có prefill_from = "profile.<key>".
export async function loadFormPrefill(supabase: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const { data: profile } = await supabase
    .from("student_profiles")
    .select("full_name, gender, phone, class_id, student_code:accounts(student_code)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return {};
  const classId = profile.class_id as string | null;
  const { data: classInfo } = classId
    ? await supabase
        .from("current_academic_catalog")
        .select("class_code, faculty_name, program_name, cohort_code")
        .eq("class_id", classId)
        .maybeSingle()
    : { data: null };
  return {
    full_name:    (profile.full_name as string) ?? "",
    gender:       (profile.gender as string) ?? "",
    student_code: (profile.student_code as unknown as { student_code: string } | null)?.student_code ?? "",
    phone:        (profile.phone as string) ?? "",
    class_code:   classInfo?.class_code ?? "",
    faculty_name: classInfo?.faculty_name ?? "",
    program_name: classInfo?.program_name ?? "",
    cohort_code:  classInfo?.cohort_code ?? "",
  };
}
