import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { catalogMutationSchema } from "@/modules/organization-catalog/schemas";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    if (!entityId && !entityType) {
      const [faculties, programs, cohorts, classes, units] = await Promise.all([
        supabase.from("faculties").select("id, current_code, current_name, is_active, source_order").order("source_order"),
        supabase.from("programs").select("id, current_code, current_name, current_faculty_id, is_active").order("current_name"),
        supabase.from("cohorts").select("id, code, display_name, is_active").order("code"),
        supabase.from("classes").select("id, current_code, current_name, current_program_id, current_cohort_id, is_active, source_number").order("current_code"),
        supabase.from("organization_units").select("id, code, name, unit_type, parent_id, faculty_id, class_id, is_active").order("name"),
      ]);
      if ([faculties, programs, cohorts, classes, units].some((result) => result.error)) throw new Error("CATALOG_OVERVIEW_FAILED");
      return NextResponse.json({
        faculties: faculties.data ?? [], programs: programs.data ?? [], cohorts: cohorts.data ?? [],
        classes: classes.data ?? [], organizationUnits: units.data ?? [],
      });
    }
    if (!entityId || !["faculty", "program", "class"].includes(entityType ?? "")) {
      throw new HttpError(400, "INVALID_QUERY", "Thiếu loại hoặc mã thực thể.");
    }
    const table = `${entityType}_versions`;
    const key = `${entityType}_id`;
    const { data, error } = await supabase.from(table).select("*").eq(key, entityId).order("valid_during");
    if (error) throw new Error("HISTORY_READ_FAILED");
    return NextResponse.json({ history: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = catalogMutationSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    if (input.entityType === "class") {
      if (!input.parentId) throw new HttpError(422, "PROGRAM_REQUIRED", "Lớp phải thuộc một Ngành.");
      const { data: program } = await supabase.from("program_versions").select("faculty_id")
        .eq("program_id", input.parentId).contains("valid_during", input.effectiveDate).maybeSingle();
      if (!program?.faculty_id) throw new HttpError(422, "INVALID_PROGRAM", "Ngành không có hiệu lực ở ngày đã chọn.");
      await requirePermission(supabase, "class.manage", { facultyId: program.faculty_id });
    } else {
      await requirePermission(supabase, "catalog.manage");
    }

    const { data, error } = await supabase.rpc("catalog_save_entity", {
      p_entity_type: input.entityType,
      p_entity_id: input.entityId ?? null,
      p_code: input.code,
      p_name: input.name,
      p_parent_id: input.parentId ?? null,
      p_cohort_id: input.cohortId ?? null,
      p_source_number: input.sourceNumber ?? null,
      p_source_order: input.sourceOrder ?? null,
      p_effective_date: input.effectiveDate,
      p_is_active: input.isActive,
      p_reason: input.reason,
      p_role_grant_id: input.roleGrantId ?? null,
    });
    if (error) throw new HttpError(409, "CATALOG_MUTATION_FAILED", error.message);
    return NextResponse.json({ id: data, message: "Đã lưu thay đổi có ngày hiệu lực." });
  } catch (error) {
    return apiError(error);
  }
}
