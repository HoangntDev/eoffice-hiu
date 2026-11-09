import { OrganizationAccountsConsole, type OrganizationAccountRow } from "@/components/organization-accounts-console";
import { redirect } from "next/navigation";
import { getOrganizationViewer, organizationAccountsEnabled } from "@/lib/auth/organization-viewer";
import { createAdminSupabase } from "@/lib/supabase/server";

export default async function AdminAccountsPage() {
  const viewer = await getOrganizationViewer();
  if (viewer?.unitType !== "school_union") redirect("/admin");
  const admin = createAdminSupabase();
  const [{ data }, enabled] = await Promise.all([
    admin.from("accounts").select("user_id, organization_id, status, organization_units(name, unit_type)").eq("account_type", "organization").order("created_at"),
    organizationAccountsEnabled(),
  ]);
  const accounts: OrganizationAccountRow[] = (data ?? []).map((row) => {
    const unit = row.organization_units as unknown as { name: string; unit_type: string } | null;
    return { userId: row.user_id, organizationId: row.organization_id!, organizationName: unit?.name ?? "—", unitType: unit?.unit_type ?? "—", status: row.status };
  });
  return <main className="page"><p className="eyebrow">Đoàn Trường</p><h1>Tài khoản tổ chức</h1><OrganizationAccountsConsole accounts={accounts} enabled={enabled} /></main>;
}
