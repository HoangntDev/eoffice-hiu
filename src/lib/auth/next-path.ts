// Đường dẫn quay lại sau đăng nhập (?next=). Chỉ nhận đường dẫn nội bộ để tránh open redirect.
export const DEFAULT_AFTER_LOGIN = "/onboarding/profile";
const INTERNAL_ORIGIN = "http://internal.invalid";

export function safeNextPath(value: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  // Phải là đường dẫn tuyệt đối trong site: chặn "//host", "/\host", URL có scheme và ký tự điều khiển.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL_ORIGIN) return fallback;
  // Không quay về trang đăng nhập hay API.
  if (url.pathname === "/login" || url.pathname.startsWith("/api/")) return fallback;
  return url.pathname + url.search;
}

// Proxy chuyển khách tới trang đăng nhập, giữ cả query string (ví dụ ?t= của mã QR điểm danh).
export function loginPathFor(pathname: string, search: string): string {
  return `/login?next=${encodeURIComponent(pathname + search)}`;
}
