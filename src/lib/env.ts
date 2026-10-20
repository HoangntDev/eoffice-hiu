// Mọi cấu hình đọc từ biến môi trường đi qua file này (bảng kê: docs/TH2/config-dependency.md).
// Luôn đọc bằng tên động (process.env[name]) để Next không nhúng giá trị NEXT_PUBLIC_* lúc build:
// app không có Supabase client phía trình duyệt, nên một bản build dùng được cho mọi môi trường.
function runtime(name: string): string | undefined {
  return process.env[name];
}

function required(name: string): string {
  const value = runtime(name);
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
  const url = runtime("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = runtime("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return url && publishableKey ? { url, publishableKey } : null;
}

export function serverSupabaseEnv() {
  return {
    ...publicSupabaseEnv(),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function appUrl() {
  return runtime("NEXT_PUBLIC_APP_URL") ?? "http://127.0.0.1:3000";
}

export function rateLimitPepper() {
  return required("AUTH_RATE_LIMIT_PEPPER");
}

export function isProduction() {
  return runtime("NODE_ENV") === "production";
}

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

// LOG_LEVEL hợp lệ thì dùng; nếu trống hoặc sai thì theo môi trường:
// production → info, test → warn (Vitest gọn log), còn lại (dev) → debug.
export function logLevel(): LogLevel {
  const configured = runtime("LOG_LEVEL")?.trim().toLowerCase();
  if (configured && (LOG_LEVELS as readonly string[]).includes(configured)) return configured as LogLevel;
  const nodeEnv = runtime("NODE_ENV");
  if (nodeEnv === "production") return "info";
  if (nodeEnv === "test") return "warn";
  return "debug";
}
