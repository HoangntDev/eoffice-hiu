import { redirect } from "next/navigation";
import FormsPage from "@/app/forms/page";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
export default async function AdminFormsPage() {
  const viewer = await getOrganizationViewer();
  if (!viewer || !["school_union", "faculty_union"].includes(viewer.unitType)) redirect("/admin");
  return <FormsPage managementBasePath="/admin/forms" />;
}
