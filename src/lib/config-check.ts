// Kiểm tra cấu hình bắt buộc (INC-01-ThieuCauHinh, issue #59).
// Khung RED: giữ đúng hành vi v1.0.0 là không kiểm tra gì; phần GREEN hiện thực các hàm này.

export const REQUIRED_CONFIG = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTH_RATE_LIMIT_PEPPER",
] as const;

export type ConfigProblem = { variable: string; problem: "missing" | "invalid" | "rejected" };
export type ServiceKeyProbe = "ok" | "rejected" | "unreachable";

export function checkRequiredConfig(_env: Record<string, string | undefined> = process.env): ConfigProblem[] {
  return [];
}

export async function probeServiceRoleKey(_url: string, _key: string, _fetchImpl: typeof fetch = fetch): Promise<ServiceKeyProbe> {
  return "ok";
}

export async function verifyConfigAtStartup(_options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}): Promise<ConfigProblem[]> {
  return [];
}

export function configStatus(): { ok: boolean; problems: ConfigProblem[] } {
  return { ok: true, problems: [] };
}
