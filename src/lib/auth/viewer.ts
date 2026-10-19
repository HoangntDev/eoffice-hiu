import "server-only";

import { cache } from "react";
import { createUserSupabase } from "@/lib/supabase/server";
import { navAccess, type NavAccess } from "./roles";

export type Viewer = {
  userId: string;
  email: string | null;
  studentCode: string | null;
  fullName: string | null;
  accountStatus: string | null;
  roles: string[];
  access: NavAccess;
};

// Người đang xem trang (null nếu chưa đăng nhập). Dùng cache để layout và trang dùng chung một lần đọc.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createUserSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [{ data: account }, { data: profile }, { data: grants }] = await Promise.all([
    supabase.from("accounts").select("student_code, status").eq("user_id", data.user.id).maybeSingle(),
    supabase.from("student_profiles").select("full_name").eq("user_id", data.user.id).maybeSingle(),
    supabase.from("role_grants").select("role_code").eq("user_id", data.user.id).is("revoked_at", null),
  ]);
  const roles = [...new Set((grants ?? []).map((grant) => grant.role_code as string))];
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    studentCode: account?.student_code ?? null,
    fullName: profile?.full_name?.trim() || null,
    accountStatus: account?.status ?? null,
    roles,
    access: navAccess(roles),
  };
});
