// Phân biệt "phiên không còn hợp lệ" với "Auth/DB không gọi được" (#85).
// Dùng được ở proxy, route handler và Server Component (không kéo module server-only).

export type SessionCheck = "signed_out" | "unavailable";

type AuthErrorLike = { name?: unknown; status?: unknown; code?: unknown };

// Mã lỗi Auth nghĩa là cookie trỏ tới phiên/người dùng không còn: coi như chưa đăng nhập.
const SIGNED_OUT_CODES = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "user_not_found",
  "bad_jwt",
]);

export function classifySessionError(error: unknown): SessionCheck {
  const value = (error ?? {}) as AuthErrorLike;
  const name = typeof value.name === "string" ? value.name : "";
  const status = typeof value.status === "number" ? value.status : undefined;
  const code = typeof value.code === "string" ? value.code : "";
  // Lỗi mạng, timeout hoặc 5xx: hạ tầng có vấn đề, không được gộp thành "chưa đăng nhập" (INC-01).
  if (name === "AuthRetryableFetchError" || status === 0 || (status !== undefined && status >= 500)) return "unavailable";
  if (SIGNED_OUT_CODES.has(code)) return "signed_out";
  if (name === "AuthSessionMissingError" || name === "AuthInvalidJwtError") return "signed_out";
  if (status === 400 || status === 401 || status === 403 || status === 404) return "signed_out";
  return "unavailable";
}

// Mọi cookie của @supabase/ssr (phiên, các mảnh .0/.1, code-verifier của PKCE): xóa hết khi đăng xuất.
export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith("sb-");
}

// Chỉ cookie phiên (sb-<ref>-auth-token và các mảnh). Không gồm code-verifier: cookie này cần cho bước
// xác thực email (PKCE) khi chưa có phiên, nên proxy không được xóa nó.
export function isSupabaseSessionCookie(name: string): boolean {
  return /^sb-.+-auth-token(\.\d+)?$/.test(name);
}

export const EXPIRED_COOKIE = { path: "/", maxAge: 0 } as const;
