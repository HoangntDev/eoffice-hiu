// SPIKE CR-01-TaiKhoanToChuc (#37): trợ giúp đăng nhập tổ chức hai bước. Không merge.
import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "@/lib/env";

export const ORG_LOGIN_COOKIE = "org_login";
export const GENERIC_ORG_MESSAGE = "Không thể đăng nhập tài khoản tổ chức. Kiểm tra lại thông tin đã nhập.";

// Phiên tạm (bước 1): cookie chỉ giữ id ngẫu nhiên của dòng organization_login_challenges, hạn 5 phút.
export async function setPendingLogin(challengeId: string) {
  (await cookies()).set(ORG_LOGIN_COOKIE, challengeId, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 300,
  });
}

export async function pendingLoginId(): Promise<string | null> {
  const value = (await cookies()).get(ORG_LOGIN_COOKIE)?.value ?? "";
  return /^[0-9a-f-]{36}$/.test(value) ? value : null;
}

export async function clearPendingLogin() {
  (await cookies()).delete(ORG_LOGIN_COOKIE);
}

export function sessionIdOf(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

// Kiểm PIN cá nhân của cán bộ bằng một client tạm, rồi bỏ đúng phiên vừa tạo (scope local),
// không đụng các phiên cá nhân khác của cán bộ.
export async function verifyPersonalPin(email: string, pin: string): Promise<boolean> {
  const { url, publishableKey } = publicSupabaseEnv();
  const probe = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password: pin });
  if (error) return false;
  await probe.auth.signOut({ scope: "local" });
  return true;
}
