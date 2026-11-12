import { notFound, redirect } from "next/navigation";
import { UnionFeeManagement } from "@/components/union-fee-management";
import { getViewer } from "@/lib/auth/viewer";
import { organizationAccountsEnabled } from "@/lib/auth/organization-viewer";
import { paymentEnabled } from "@/lib/payments";
import { createUserSupabase } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ campaign?: string; class?: string }> };

export default async function PersonalPaymentManagementPage({ searchParams }: Props) {
  if (!await paymentEnabled()) notFound();
  if (await organizationAccountsEnabled()) redirect("/admin/payments");
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/payments/manage");
  if (!viewer.roles.some((role) => role === "faculty_manager" || role === "faculty_executive")) notFound();
  const supabase = await createUserSupabase();
  return <UnionFeeManagement supabase={supabase} searchParams={searchParams} basePath="/payments/manage" />;
}
