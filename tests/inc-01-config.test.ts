// INC-01-ThieuCauHinh (issue #59): tái hiện thiếu/sai cấu hình bắt buộc.
// K1a thiếu AUTH_RATE_LIMIT_PEPPER, K1b SUPABASE_SERVICE_ROLE_KEY sai, K1c thiếu NEXT_PUBLIC_SUPABASE_URL.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

// Supabase giả lập (YC2): không gọi mạng. adminResult là kết quả của truy vấn đếm auth_attempts.
const supabaseMock = vi.hoisted(() => ({
  adminResult: { count: 0, error: null as unknown, status: 200 } as { count: number | null; error: unknown; status: number },
  rpcResult: { data: true, error: null as unknown },
}));
vi.mock("@/lib/supabase/server", () => {
  const query = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "insert", "maybeSingle"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => resolve(supabaseMock.adminResult);
    return chain;
  };
  const rpc = () => ({ abortSignal: () => Promise.resolve(supabaseMock.rpcResult) });
  return {
    createAdminSupabase: () => ({ from: query }),
    createUserSupabase: async () => ({ auth: { getClaims: async () => ({ data: null }) }, from: query }),
    createPublicSupabase: () => ({ rpc }),
  };
});

import { checkRequiredConfig, probeServiceRoleKey, verifyConfigAtStartup } from "@/lib/config-check";
import { GET as health } from "@/app/api/health/route";
import { POST as login } from "@/app/api/auth/login/route";
import { proxy } from "@/proxy";

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
  AUTH_RATE_LIMIT_PEPPER: "pepper-test-value-0123456789",
};

function useEnv(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value ?? "");
}

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const push = (line: unknown) => { try { lines.push(JSON.parse(String(line))); } catch { /* bỏ dòng không phải JSON */ } };
  vi.spyOn(console, "info").mockImplementation(push);
  vi.spyOn(console, "warn").mockImplementation(push);
  vi.spyOn(console, "error").mockImplementation(push);
  return lines;
}

const fetchStatus = (status: number) => vi.fn(async () => new Response("{}", { status }));

beforeEach(() => {
  vi.stubEnv("LOG_LEVEL", "info");
  useEnv(VALID_ENV);
  supabaseMock.adminResult = { count: 0, error: null, status: 200 };
  supabaseMock.rpcResult = { data: true, error: null };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("K1a – thiếu AUTH_RATE_LIMIT_PEPPER", () => {
  it("kiểm tra cấu hình báo đúng tên biến bị thiếu", () => {
    expect(checkRequiredConfig({ ...VALID_ENV, AUTH_RATE_LIMIT_PEPPER: "" }))
      .toEqual([{ variable: "AUTH_RATE_LIMIT_PEPPER", problem: "missing" }]);
    expect(checkRequiredConfig(VALID_ENV)).toEqual([]);
  });

  it("lúc khởi động ghi log error config.invalid có tên biến, không có giá trị", async () => {
    const lines = captureLogs();
    const problems = await verifyConfigAtStartup({ env: { ...VALID_ENV, AUTH_RATE_LIMIT_PEPPER: "" }, fetchImpl: fetchStatus(200) });
    expect(problems).toEqual([{ variable: "AUTH_RATE_LIMIT_PEPPER", problem: "missing" }]);
    const line = lines.find((l) => l.event === "config.invalid");
    expect(line).toMatchObject({ level: "error", problems: [{ variable: "AUTH_RATE_LIMIT_PEPPER", problem: "missing" }] });
    expect(JSON.stringify(lines)).not.toContain(VALID_ENV.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("/api/health trả 503, config: error, không lộ tên biến", async () => {
    useEnv({ AUTH_RATE_LIMIT_PEPPER: "" });
    captureLogs();
    const response = await health(new Request("http://localhost/api/health"));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({ app: "error", config: "error", db: "ok" });
    expect(JSON.stringify(body)).not.toContain("PEPPER");
  });
});

describe("K1b – SUPABASE_SERVICE_ROLE_KEY sai", () => {
  it("thử khóa với Auth admin: 401/403 là bị từ chối, 200 là đúng, lỗi mạng là chưa xác định", async () => {
    expect(await probeServiceRoleKey(VALID_ENV.NEXT_PUBLIC_SUPABASE_URL, "sai", fetchStatus(403))).toBe("rejected");
    expect(await probeServiceRoleKey(VALID_ENV.NEXT_PUBLIC_SUPABASE_URL, "sai", fetchStatus(401))).toBe("rejected");
    expect(await probeServiceRoleKey(VALID_ENV.NEXT_PUBLIC_SUPABASE_URL, "dung", fetchStatus(200))).toBe("ok");
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await probeServiceRoleKey(VALID_ENV.NEXT_PUBLIC_SUPABASE_URL, "dung", down)).toBe("unreachable");
  });

  it("lúc khởi động khóa bị từ chối thì ghi config.invalid", async () => {
    const lines = captureLogs();
    const fetchImpl = fetchStatus(403);
    const problems = await verifyConfigAtStartup({ env: VALID_ENV, fetchImpl });
    expect(problems).toEqual([{ variable: "SUPABASE_SERVICE_ROLE_KEY", problem: "rejected" }]);
    expect(lines.find((l) => l.event === "config.invalid")).toBeTruthy();
    expect(JSON.stringify(lines)).not.toContain(VALID_ENV.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("đăng nhập khi Supabase từ chối khóa: 503 SERVICE_NOT_CONFIGURED kèm mã tham chiếu, không phải 500", async () => {
    const lines = captureLogs();
    supabaseMock.adminResult = { count: null, error: { code: "PGRST301", message: "Expected 3 parts in JWT; got 1" }, status: 401 };
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentCode: "2201110202", pin: "123456" }),
    }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({ error: "SERVICE_NOT_CONFIGURED" });
    expect(body.message).toContain(`Mã tham chiếu: ${body.reference}`);
    expect(lines.find((l) => l.event === "config.invalid")).toMatchObject({ variable: "SUPABASE_SERVICE_ROLE_KEY", reference: body.reference });
  });
});

describe("K1c – thiếu NEXT_PUBLIC_SUPABASE_URL", () => {
  beforeEach(() => useEnv({ NEXT_PUBLIC_SUPABASE_URL: "" }));

  it("kiểm tra cấu hình báo thiếu NEXT_PUBLIC_SUPABASE_URL; URL sai dạng cũng bị báo", () => {
    expect(checkRequiredConfig({ ...VALID_ENV, NEXT_PUBLIC_SUPABASE_URL: "" }))
      .toEqual([{ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "missing" }]);
    expect(checkRequiredConfig({ ...VALID_ENV, NEXT_PUBLIC_SUPABASE_URL: "127.0.0.1:56321" }))
      .toEqual([{ variable: "NEXT_PUBLIC_SUPABASE_URL", problem: "invalid" }]);
  });

  it("trang: proxy trả 503 có câu thân thiện và mã tham chiếu, không ném lỗi thô", async () => {
    const lines = captureLogs();
    const response = await proxy(new NextRequest("http://localhost/login"));
    const html = await response.text();
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Hệ thống tạm thời chưa sẵn sàng");
    const reference = response.headers.get("x-request-id")!.slice(0, 8);
    expect(html).toContain(reference);
    expect(lines.find((l) => l.event === "config.missing_env")).toMatchObject({ level: "error", variable: "NEXT_PUBLIC_SUPABASE_URL" });
  });

  it("API: proxy trả JSON 503 SERVICE_NOT_CONFIGURED", async () => {
    captureLogs();
    const response = await proxy(new NextRequest("http://localhost/api/event-programs"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "SERVICE_NOT_CONFIGURED" });
  });

  it("/api/health vẫn được đi qua proxy để báo trạng thái", async () => {
    captureLogs();
    const response = await proxy(new NextRequest("http://localhost/api/health"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
