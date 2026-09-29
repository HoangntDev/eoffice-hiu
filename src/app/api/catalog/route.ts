import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const { supabase } = await requireUser();
    const [{ data: catalog, error }, { data: options, error: optionsError }] = await Promise.all([
      supabase.from("current_academic_catalog").select("*")
        .eq("class_is_active", true).eq("program_is_active", true).eq("faculty_is_active", true)
        .order("source_order").order("faculty_name").order("program_name").order("class_code"),
      supabase.from("reference_options").select("id, category, code, label").eq("is_active", true)
        .order("category").order("label"),
    ]);
    if (error || optionsError) throw new Error("CATALOG_READ_FAILED");
    return NextResponse.json({ catalog: catalog ?? [], referenceOptions: options ?? [] });
  } catch (error) {
    return apiError(error);
  }
}
