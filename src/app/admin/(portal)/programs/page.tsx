import { redirect } from "next/navigation";
import ProgramsPage from "@/app/programs/page";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
export default async function AdminProgramsPage() {
  const viewer = await getOrganizationViewer();
  if (viewer?.unitType !== "faculty_union") redirect("/admin");
  return <ProgramsPage basePath="/admin/programs" />;
}
