import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type GrantRow = {
  role_code: string;
  organization_units: { id: string; name: string; unit_type: string } | null;
};

// UI scoping only; the RPCs and RLS policies remain the authority for every action.
export async function loadEventProgramViewer(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("role_grants")
    .select("role_code, organization_units(id, name, unit_type)")
    .eq("user_id", userId)
    .is("revoked_at", null);
  const grants = (data ?? []) as unknown as GrantRow[];
  const managedOrgs = grants
    .filter((g) => ["faculty_manager", "faculty_executive"].includes(g.role_code) && g.organization_units?.unit_type === "faculty_union")
    .map((g) => ({ id: g.organization_units!.id, name: g.organization_units!.name }))
    .filter((org, index, all) => all.findIndex((o) => o.id === org.id) === index);
  const isReviewer = grants.some((g) => g.role_code === "office" || g.role_code === "school_admin");
  return { managedOrgs, isReviewer };
}
