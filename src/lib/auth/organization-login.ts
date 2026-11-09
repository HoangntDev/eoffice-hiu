import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isProduction, publicSupabaseEnv } from "@/lib/env";
import { pendingLoginCookieOptions } from "@/modules/organization-auth/policy";

export const ORG_LOGIN_COOKIE = "eoffice_org_login";

export async function setPendingOrganizationLogin(challengeId: string) {
  (await cookies()).set(ORG_LOGIN_COOKIE, challengeId, {
    ...pendingLoginCookieOptions(),
    secure: isProduction(),
  });
}

export async function pendingOrganizationLoginId(): Promise<string | null> {
  const value = (await cookies()).get(ORG_LOGIN_COOKIE)?.value ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export async function clearPendingOrganizationLogin() {
  (await cookies()).delete(ORG_LOGIN_COOKIE);
}

export function sessionIdOf(accessToken: string): string | null {
  try {
    const encoded = accessToken.split(".")[1];
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

// Xác minh PIN cá nhân bằng một client tạm và chỉ thu hồi phiên vừa tạo.
export async function verifyPersonalPin(email: string, pin: string): Promise<boolean> {
  const { url, publishableKey } = publicSupabaseEnv();
  const probe = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password: pin });
  if (error) return false;
  await probe.auth.signOut({ scope: "local" });
  return true;
}
