// Mọi cấu hình đọc từ biến môi trường đi qua file này (bảng kê: docs/TH2/config-dependency.md).
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MISSING_ENV:${name}`);
  }
  return value;
}

export function publicSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

// Proxy bỏ qua kiểm tra phiên khi chưa cấu hình Supabase, nên không ném lỗi.
export function optionalPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export function serverSupabaseEnv() {
  return {
    ...publicSupabaseEnv(),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

export function rateLimitPepper() {
  return required("AUTH_RATE_LIMIT_PEPPER");
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

// LOG_LEVEL hợp lệ thì dùng; nếu trống hoặc sai thì theo môi trường:
// production → info, test → warn (Vitest gọn log), còn lại (dev) → debug.
export function logLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (configured && (LOG_LEVELS as readonly string[]).includes(configured)) return configured as LogLevel;
  if (process.env.NODE_ENV === "production") return "info";
  if (process.env.NODE_ENV === "test") return "warn";
  return "debug";
}
