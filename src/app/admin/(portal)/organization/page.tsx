import { redirect } from "next/navigation";
import { OrganizationConsole } from "@/components/organization-console";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
export default async function AdminOrganizationPage() {
  const viewer = await getOrganizationViewer();
  if (viewer?.unitType !== "school_union") redirect("/admin");
  return <main className="page"><p className="eyebrow">Quản trị</p><h1>Cơ cấu tổ chức</h1><OrganizationConsole /></main>;
}
