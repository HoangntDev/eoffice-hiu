// Mọi cấu hình đọc từ biến môi trường đi qua file này (bảng kê: docs/TH2/config-dependency.md).
// Luôn đọc bằng tên động (process.env[name]) để Next không nhúng giá trị NEXT_PUBLIC_* lúc build:
// app không có Supabase client phía trình duyệt, nên một bản build dùng được cho mọi môi trường.
import { resolvePaymentProvider, type PaymentProvider } from "@/modules/payments/provider";

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

const PUBLIC_SUPABASE_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const;

// Tên các biến Supabase công khai đang thiếu (proxy dùng để trả 503 rõ ràng, INC-01).
export function missingPublicSupabaseVars(): string[] {
  return PUBLIC_SUPABASE_VARS.filter((name) => !runtime(name)?.trim());
}

// Không ném lỗi; trả null khi thiếu. Đọc qua vòng lặp chứ không gọi runtime("NEXT_PUBLIC_…") với chuỗi cố định:
// ở v1.0.0, bản build thay biểu thức đó bằng giá trị lúc build khi rút gọn điều kiện, nên hàm luôn trả object
// và proxy ném lỗi "URL and Key are required" thay vì bỏ qua (INC-01, trường hợp K1c).
export function optionalPublicSupabaseEnv() {
  const [url, publishableKey] = PUBLIC_SUPABASE_VARS.map((name) => runtime(name)?.trim() || undefined);
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

const VNPAY_VARS = ["VNP_TMN_CODE", "VNP_HASH_SECRET", "VNP_URL", "VNP_RETURN_URL"] as const;

export function missingVnpayVars(): string[] {
  return VNPAY_VARS.filter((name) => !runtime(name)?.trim());
}

export function vnpayEnv() {
  return {
    tmnCode: required("VNP_TMN_CODE"),
    hashSecret: required("VNP_HASH_SECRET"),
    paymentUrl: required("VNP_URL"),
    returnUrl: required("VNP_RETURN_URL"),
  };
}

const PAYPAL_VARS = [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_API_URL",
  "PAYPAL_RETURN_URL",
  "PAYPAL_CANCEL_URL",
  "PAYPAL_VND_PER_USD",
] as const;

export function missingPaypalVars(): string[] {
  return PAYPAL_VARS.filter((name) => !runtime(name)?.trim());
}

export function paypalEnv() {
  const vndPerUsd = Number(required("PAYPAL_VND_PER_USD"));
  if (!Number.isFinite(vndPerUsd) || vndPerUsd <= 0) {
    throw new Error("CONFIG_INVALID:PAYPAL_VND_PER_USD");
  }
  return {
    clientId: required("PAYPAL_CLIENT_ID"),
    clientSecret: required("PAYPAL_CLIENT_SECRET"),
    apiUrl: required("PAYPAL_API_URL"),
    returnUrl: required("PAYPAL_RETURN_URL"),
    cancelUrl: required("PAYPAL_CANCEL_URL"),
    vndPerUsd,
  };
}

export function paymentProvider(): PaymentProvider {
  try {
    return resolvePaymentProvider(runtime("PAYMENT_PROVIDER"));
  } catch {
    throw new Error("CONFIG_INVALID:PAYMENT_PROVIDER");
  }
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

// Lời gọi database (PostgREST, Auth, Storage) lâu hơn ngưỡng này bị ghi log warn "db.slow".
export const DEFAULT_DB_SLOW_MS = 1000;
export function dbSlowMs(): number {
  const value = Number(runtime("DB_SLOW_MS"));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DB_SLOW_MS;
}
