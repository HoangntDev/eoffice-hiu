import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseEnv, serverSupabaseEnv } from "@/lib/env";
import { instrumentedFetch } from "@/lib/supabase/instrumented-fetch";

export async function createUserSupabase() {
  const cookieStore = await cookies();
  const { url, publishableKey } = publicSupabaseEnv();

  return createServerClient(url, publishableKey, {
    global: { fetch: instrumentedFetch("supabase.user") },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        // Server Component không được ghi cookie (Next ném lỗi). Khi supabase-js tự xóa phiên đã bị thu hồi
        // trong lúc render thì bỏ qua để trang hiển thị như khách thay vì 500 (#85); việc xóa cookie thật
        // do proxy và route handler đảm nhận.
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Đang render Server Component: không ghi được cookie, giữ nguyên.
        }
      },
    },
  });
}

export function createAdminSupabase() {
  const { url, serviceRoleKey } = serverSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    global: { fetch: instrumentedFetch("supabase.admin") },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createPublicSupabase() {
  const { url, publishableKey } = publicSupabaseEnv();
  return createClient(url, publishableKey, {
    global: { fetch: instrumentedFetch("supabase.public") },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
