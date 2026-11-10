import { redirect } from "next/navigation";
import { OrganizationLoginForm } from "@/components/organization-login-form";
import { pendingOrganizationLoginId } from "@/lib/auth/organization-login";
import { organizationAccountsEnabled } from "@/lib/auth/organization-viewer";

export default async function OfficerLoginPage() {
  if (!await organizationAccountsEnabled()) redirect("/login");
  if (!await pendingOrganizationLoginId()) redirect("/admin/login");
  return <main className="page narrow"><OrganizationLoginForm step="officer" /></main>;
}
