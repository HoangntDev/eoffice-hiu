import { redirect } from "next/navigation";
import { OrganizationLoginForm } from "@/components/organization-login-form";
import { organizationAccountsEnabled } from "@/lib/auth/organization-viewer";
import { createAdminSupabase } from "@/lib/supabase/server";
import { groupLoginUnits } from "@/modules/organization-auth/display";

export default async function OrganizationLoginPage() {
  if (!await organizationAccountsEnabled()) redirect("/login");
  const admin = createAdminSupabase();
  const { data } = await admin.rpc("list_organization_login_units");
  const groups = groupLoginUnits((data ?? []).map((unit: { organization_id: string; name: string; unit_type: "school_union" | "office" | "faculty_union" }) => ({
    id: unit.organization_id as string,
    name: unit.name as string,
    unitType: unit.unit_type as "school_union" | "office" | "faculty_union",
    isActive: true,
    hasAccount: true,
  })));
  return <main className="page narrow"><OrganizationLoginForm step="organization" groups={groups} /></main>;
}
