import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { saveFormSchema } from "@/modules/forms/schemas";

export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");

    let query = supabase
      .from("forms")
      .select("id, owner_org_id, title, description, audience_rule, status, opens_at, closes_at, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (orgId) {
      query = query.eq("owner_org_id", orgId);
    } else {
      // Return forms the user can fill (published) OR manage (owner org)
      const { data: grants } = await supabase
        .from("role_grants")
        .select("organization_id")
        .eq("user_id", user.id)
        .is("revoked_at", null);
      const orgIds = (grants ?? []).map((g) => g.organization_id);
      if (orgIds.length > 0) {
        query = query.or(`status.eq.published,owner_org_id.in.(${orgIds.join(",")})`);
      } else {
        query = query.eq("status", "published");
      }
    }

    const { data, error } = await query;
    if (error) throw new Error("LIST_FORMS_FAILED");
    return NextResponse.json({ forms: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = saveFormSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_form", {
      p_id:                        input.id ?? null,
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
      if (error.message.includes("FORBIDDEN")) throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền tạo biểu mẫu cho đơn vị này.");
      throw new HttpError(422, "SAVE_FORM_FAILED", error.message);
    }
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
