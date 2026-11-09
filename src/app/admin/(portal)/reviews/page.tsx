import { redirect } from "next/navigation";
import ProgramsPage from "@/app/programs/page";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
export default async function AdminReviewsPage() {
  const viewer = await getOrganizationViewer();
  if (viewer?.unitType !== "office") redirect("/admin");
  return <ProgramsPage />;
}
