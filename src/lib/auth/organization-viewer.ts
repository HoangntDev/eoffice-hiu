import "server-only";

import { cache } from "react";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import type { OrganizationUnitType } from "@/modules/organization-auth/routing";

export type OrganizationViewer = {
  accountUserId: string;
  organizationId: string;
  unitName: string;
  unitType: OrganizationUnitType;
  officerUserId: string | null;
  officerCode: string | null;
  officerName: string | null;
};

export async function organizationAccountsEnabled(): Promise<boolean> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("feature_flag_enabled", { p_key: "ORG_ACCOUNTS_ENABLED" });
  return !error && data === true;
}

export const getOrganizationViewer = cache(async (): Promise<OrganizationViewer | null> => {
  const supabase = await createUserSupabase();
  const { data } = await supabase.auth.getClaims();
  const accountUserId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!accountUserId) return null;

  const admin = createAdminSupabase();
  const { data: account } = await admin
    .from("accounts")
    .select("account_type, organization_id, status, organization_units(name, unit_type)")
    .eq("user_id", accountUserId)
    .maybeSingle();
  const unit = account?.organization_units as unknown as { name: string; unit_type: OrganizationUnitType } | null;
  if (account?.account_type !== "organization" || account.status !== "active" || !account.organization_id || !unit) return null;

  const { data: officerUserId } = await supabase.rpc("current_officer_user_id");
  let officerCode: string | null = null;
  let officerName: string | null = null;
  if (typeof officerUserId === "string") {
    const [{ data: officer }, { data: profile }] = await Promise.all([
      admin.from("accounts").select("student_code").eq("user_id", officerUserId).maybeSingle(),
      admin.from("student_profiles").select("full_name").eq("user_id", officerUserId).maybeSingle(),
    ]);
    officerCode = officer?.student_code ?? null;
    officerName = profile?.full_name?.trim() || null;
  }

  return {
    accountUserId,
    organizationId: account.organization_id,
    unitName: unit.name,
    unitType: unit.unit_type,
    officerUserId: typeof officerUserId === "string" ? officerUserId : null,
    officerCode,
    officerName,
  };
});
