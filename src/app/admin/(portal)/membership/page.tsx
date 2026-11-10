import { redirect } from "next/navigation";
import MembershipPage from "@/app/office/membership/page";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
export default async function AdminMembershipPage() {
  const viewer = await getOrganizationViewer();
  if (viewer?.unitType !== "office") redirect("/admin");
  return <MembershipPage />;
}
