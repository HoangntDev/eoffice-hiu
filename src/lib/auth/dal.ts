import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createUserSupabase } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";

export async function requireUser(): Promise<{ user: User; supabase: SupabaseClient }> {
  const supabase = await createUserSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập để tiếp tục.");
  }
  return { user: data.user, supabase };
}

export async function requirePermission(
  supabase: SupabaseClient,
  permission: string,
  options: { facultyId?: string | null; organizationId?: string | null } = {},
) {
  const { data, error } = await supabase.rpc("has_permission", {
    p_permission: permission,
    p_faculty_id: options.facultyId ?? null,
    p_organization_id: options.organizationId ?? null,
  });
  if (error || data !== true) {
    throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  }
}
