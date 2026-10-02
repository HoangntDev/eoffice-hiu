import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseEnv, serverSupabaseEnv } from "@/lib/env";

export async function createUserSupabase() {
  const cookieStore = await cookies();
  const { url, publishableKey } = publicSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          cookieStore.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });
}

export function createAdminSupabase() {
  const { url, serviceRoleKey } = serverSupabaseEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createPublicSupabase() {
  const { url, publishableKey } = publicSupabaseEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
