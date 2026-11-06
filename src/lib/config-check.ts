// Kiểm tra cấu hình bắt buộc (INC-01-ThieuCauHinh, issue #59).
// v1.0.0 chỉ đọc biến môi trường khi có request cần tới, nên thiếu/sai cấu hình vẫn khởi động "Ready"
// và không để lại log. Module này kiểm tra ngay lúc khởi động (src/instrumentation.ts), ghi log
// config.invalid kèm TÊN biến (không bao giờ ghi giá trị) và cho /api/health báo config: "error".
import { logEvent } from "@/lib/log";

export const REQUIRED_CONFIG = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_RATE_LIMIT_PEPPER",
] as const;

export type ConfigProblem = { variable: string; problem: "missing" | "invalid" | "rejected" };
export type ServiceKeyProbe = "ok" | "rejected" | "unreachable";

type Env = Record<string, string | undefined>;
const PROBE_TIMEOUT_MS = 3000;
const STATE_KEY = Symbol.for("eoffice.configStartupProblems");
type StateHolder = { [STATE_KEY]?: ConfigProblem[] };

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Đọc theo tên trong vòng lặp (không viết process.env.NEXT_PUBLIC_… trực tiếp) để bản build
// không thay bằng giá trị lúc build – xem INC-01, trường hợp K1c.
export function checkRequiredConfig(env: Env = process.env): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  for (const variable of REQUIRED_CONFIG) {
    const value = env[variable]?.trim();
    if (!value) problems.push({ variable, problem: "missing" });
    else if (variable === "NEXT_PUBLIC_SUPABASE_URL" && !isHttpUrl(value)) problems.push({ variable, problem: "invalid" });
  }
  return problems;
}

// Gọi thử một endpoint chỉ dành cho service role. Khóa sai hoặc dùng nhầm publishable key → 401/403.
// Không gọi được (Supabase chưa chạy, mạng) không phải lỗi cấu hình → "unreachable".
export async function probeServiceRoleKey(url: string, key: string, fetchImpl: typeof fetch = fetch): Promise<ServiceKeyProbe> {
  try {
    const response = await fetchImpl(`${url.replace(/\/+$/, "")}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return "rejected";
    return response.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function verifyConfigAtStartup(
  { env = process.env, fetchImpl = fetch }: { env?: Env; fetchImpl?: typeof fetch } = {},
): Promise<ConfigProblem[]> {
  const problems = checkRequiredConfig(env);
  let serviceRoleKey: ServiceKeyProbe | "skipped" = "skipped";
  const blocked = problems.some((p) => p.variable === "NEXT_PUBLIC_SUPABASE_URL" || p.variable === "SUPABASE_SERVICE_ROLE_KEY");
  if (!blocked) {
    serviceRoleKey = await probeServiceRoleKey(env.NEXT_PUBLIC_SUPABASE_URL!.trim(), env.SUPABASE_SERVICE_ROLE_KEY!.trim(), fetchImpl);
    if (serviceRoleKey === "rejected") problems.push({ variable: "SUPABASE_SERVICE_ROLE_KEY", problem: "rejected" });
  }
  (globalThis as StateHolder)[STATE_KEY] = problems.filter((p) => p.problem === "rejected");

  if (problems.length > 0) {
    logEvent("error", "config.invalid", { source: "config", problems, checked: REQUIRED_CONFIG.length });
  } else {
    logEvent("info", "config.ok", { source: "config", checked: REQUIRED_CONFIG.length, serviceRoleKey });
  }
  if (serviceRoleKey === "unreachable") {
    logEvent("warn", "config.service_role_key_unverified", { source: "config", reason: "SUPABASE_UNREACHABLE" });
  }
  return problems;
}

// Trạng thái hiện tại: kiểm tra có/không theo biến môi trường đang chạy, cộng kết quả thử khóa lúc khởi động.
export function configStatus(env: Env = process.env): { ok: boolean; problems: ConfigProblem[] } {
  const problems = [...checkRequiredConfig(env), ...((globalThis as StateHolder)[STATE_KEY] ?? [])];
  return { ok: problems.length === 0, problems };
}
