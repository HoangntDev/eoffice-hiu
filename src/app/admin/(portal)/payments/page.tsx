import { notFound } from "next/navigation";
import { UnionFeeManagement } from "@/components/union-fee-management";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
import { paymentEnabled } from "@/lib/payments";
import { createUserSupabase } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ campaign?: string; class?: string }> };

export default async function OrganizationPaymentManagementPage({ searchParams }: Props) {
  if (!await paymentEnabled()) notFound();
  const viewer = await getOrganizationViewer();
  if (viewer?.unitType !== "faculty_union") notFound();
  const supabase = await createUserSupabase();
  return <UnionFeeManagement supabase={supabase} searchParams={searchParams} basePath="/admin/payments" />;
}
