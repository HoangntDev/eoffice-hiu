import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLogLine, logEvent, maskEmail, maskStudentCode, setLogSink } from "@/lib/log";
import { instrumentedFetch, supabaseOperation } from "@/lib/supabase/instrumented-fetch";
import { apiError, HttpError } from "@/lib/http";

afterEach(() => {
  setLogSink(undefined);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function captureConsole() {
  const lines: Record<string, unknown>[] = [];
  const push = (line: unknown) => lines.push(JSON.parse(String(line)));
  vi.spyOn(console, "info").mockImplementation(push);
  vi.spyOn(console, "warn").mockImplementation(push);
  vi.spyOn(console, "error").mockImplementation(push);
  return lines;
}

describe("lọc mức log theo LOG_LEVEL", () => {
  it.each([
    ["debug", ["debug", "info", "warn", "error"]],
    ["info", ["info", "warn", "error"]],
    ["warn", ["warn", "error"]],
    ["error", ["error"]],
  ] as const)("LOG_LEVEL=%s chỉ ghi %j, cả console lẫn sink file", (configured, expected) => {
    vi.stubEnv("LOG_LEVEL", configured);
    const lines = captureConsole();
    const sink = vi.fn();
    setLogSink(sink);
    for (const level of ["debug", "info", "warn", "error"] as const) logEvent(level, `test.${level}`);
    expect(lines.map((line) => line.level)).toEqual(expected);
    expect(sink.mock.calls.map(([level]) => level)).toEqual(expected);
  });

  it("sink nhận đúng dòng JSON đã ghi ra console", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines = captureConsole();
    const sink = vi.fn();
    setLogSink(sink);
    logEvent("info", "event_program.submitted", { requestId: "req-12345678", programId: "p1" });
    expect(JSON.parse(sink.mock.calls[0][1])).toEqual(lines[0]);
  });

  it("sink lỗi không làm hỏng lời gọi logEvent", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    captureConsole();
    setLogSink(() => { throw new Error("disk full"); });
    expect(() => logEvent("info", "x.y")).not.toThrow();
  });
});

describe("cấu trúc dòng log", () => {
  it("có ts, level, source, event, requestId theo thứ tự; source mặc định là tiền tố của event", () => {
    const line = JSON.parse(formatLogLine("info", "program_registration.registered", { requestId: "abcdefgh-1", programId: "p" }));
    expect(Object.keys(line).slice(0, 5)).toEqual(["ts", "level", "source", "event", "requestId"]);
    expect(line).toMatchObject({ level: "info", source: "program_registration", event: "program_registration.registered", programId: "p" });
    expect(new Date(line.ts).toISOString()).toBe(line.ts);
  });

  it("source truyền vào được ưu tiên; không có requestId thì không có trường đó", () => {
    const line = JSON.parse(formatLogLine("warn", "db.slow", { source: "supabase.admin" }));
    expect(line.source).toBe("supabase.admin");
    expect(line).not.toHaveProperty("requestId");
  });
});

describe("che dữ liệu nhạy cảm", () => {
  it("che giữa MSSV dạng 221***34", () => {
    expect(maskStudentCode("2210012334")).toBe("221***34");
    expect(maskStudentCode("123")).toBe("***");
    expect(maskStudentCode(undefined)).toBe("***");
  });

  it("che email chỉ giữ ký tự đầu và tên miền", () => {
    expect(maskEmail("nguyenvana@student.hiu.vn")).toBe("n***@student.hiu.vn");
  });

  it("trường studentCode/mssv tự được che, email ở bất kỳ trường nào cũng bị che", () => {
    const line = formatLogLine("warn", "auth.login_failed", {
      studentCode: "2210012334",
      nested: { mssv: "2610099999", contact: "sv.a@student.hiu.vn" },
      note: "x@y.vn",
    });
    expect(line).toContain("221***34");
    expect(line).toContain("261***99");
    expect(line).not.toContain("2210012334");
    expect(line).not.toContain("sv.a@");
    expect(JSON.parse(line).note).toBe("x***@y.vn");
  });

  it("không bao giờ ghi PIN, mật khẩu, token, cookie, secret, apikey (bỏ cả tên khóa)", () => {
    const line = formatLogLine("info", "auth.test", {
      pin: "123456",
      newPin: "654321",
      password: "p@ss",
      accessToken: "eyJhbGciOi",
      refresh_token: "r-tok",
      cookie: "sb-access-token=abc",
      authorization: "Bearer abc",
      serviceRoleKey: "srk",
      apikey: "k",
      clientSecret: "s",
      publishableKey: "pk",
      nested: { otpToken: "999999", ok: 1 },
      cycleKey: "2026-2027",
      keep: "giữ lại",
    });
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ keep: "giữ lại", cycleKey: "2026-2027", nested: { ok: 1 } });
    expect(line).not.toMatch(/123456|654321|p@ss|eyJhbGciOi|r-tok|Bearer|srk|999999/);
    expect(line).not.toMatch(/"(pin|newPin|password|accessToken|refresh_token|cookie|authorization|serviceRoleKey|apikey|clientSecret|publishableKey|otpToken)"/);
  });
});

describe("log lời gọi database", () => {
  it("đặt tên thao tác theo bảng/hàm/endpoint, không lấy query string hay id", () => {
    expect(supabaseOperation("http://db/rest/v1/accounts?select=user_id&student_code=eq.2210012334", "GET")).toBe("select.accounts");
    expect(supabaseOperation("http://db/rest/v1/rpc/submit_event_program", "POST")).toBe("rpc.submit_event_program");
    expect(supabaseOperation("http://db/auth/v1/token?grant_type=password", "POST")).toBe("auth.token");
    expect(supabaseOperation("http://db/auth/v1/admin/users/0b6f3a8e-1111-4222-8333-444455556666", "GET")).toBe("auth.admin/users");
    expect(supabaseOperation("http://db/storage/v1/object/event-program-plans/a/b.pdf", "POST")).toBe("storage.post.object/event-program-plans");
  });

  it("mất kết nối: ghi error db.call_failed kèm mã lỗi và durationMs rồi ném lại lỗi", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const lines = captureConsole();
    const refused = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    const fetcher = instrumentedFetch("supabase.admin", vi.fn().mockRejectedValue(refused));
    await expect(fetcher("http://db/rest/v1/rpc/has_permission", { method: "POST" })).rejects.toBe(refused);
    expect(lines[0]).toMatchObject({ level: "error", event: "db.call_failed", source: "supabase.admin", operation: "rpc.has_permission", errorCode: "ECONNREFUSED" });
    expect(typeof lines[0].durationMs).toBe("number");
  });

  it("HTTP 5xx hoặc lỗi lược đồ là error; lỗi nghiệp vụ P0001 thì không ghi", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const lines = captureConsole();
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const base = vi.fn()
      .mockResolvedValueOnce(json(503, { code: "PGRST001", message: "no connection" }))
      .mockResolvedValueOnce(json(404, { code: "42883", message: "function does not exist" }))
      .mockResolvedValueOnce(json(400, { code: "P0001", message: "FORBIDDEN" }));
    const fetcher = instrumentedFetch("supabase.user", base);
    await fetcher("http://db/rest/v1/accounts");
    await fetcher("http://db/rest/v1/rpc/missing_fn", { method: "POST" });
    await fetcher("http://db/rest/v1/rpc/review_event_program", { method: "POST" });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ event: "db.call_failed", status: 503, errorCode: "PGRST001", operation: "select.accounts" });
    expect(lines[1]).toMatchObject({ event: "db.call_failed", status: 404, errorCode: "42883", operation: "rpc.missing_fn" });
  });

  it("chậm hơn DB_SLOW_MS thì ghi warn db.slow", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("DB_SLOW_MS", "5");
    const lines = captureConsole();
    const slow = vi.fn(() => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response("[]")), 20)));
    await instrumentedFetch("proxy", slow)("http://db/rest/v1/accounts");
    expect(lines[0]).toMatchObject({ level: "warn", event: "db.slow", operation: "select.accounts", thresholdMs: 5 });
    expect(lines[0].durationMs as number).toBeGreaterThanOrEqual(5);
  });
});

describe("lỗi chưa xử lý ở API", () => {
  it("người dùng thấy câu thân thiện + mã tham chiếu; stack chỉ nằm trong log", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines = captureConsole();
    const response = await apiError(new Error("boom at /srv/app.ts"));
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.reference).toMatch(/^[0-9a-f-]{8}$/);
    expect(body.message).toContain(`Mã tham chiếu: ${body.reference}`);
    expect(JSON.stringify(body)).not.toContain("boom");
    expect(lines[0]).toMatchObject({ level: "error", event: "api.unhandled_error", reference: body.reference, errorMessage: "boom at /srv/app.ts" });
    expect(lines[0].stack).toBeTruthy();
  });

  it("thiếu biến môi trường: ghi tên biến (không ghi giá trị), trả 503 kèm mã tham chiếu", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines = captureConsole();
    const response = await apiError(new Error("MISSING_ENV:AUTH_RATE_LIMIT_PEPPER"));
    expect(response.status).toBe(503);
    expect((await response.json()).reference).toBe(lines[0].reference);
    expect(lines[0]).toMatchObject({ event: "config.missing_env", variable: "AUTH_RATE_LIMIT_PEPPER" });
  });

  it("truy cập bị từ chối ghi warn auth.access_denied; đăng nhập sai không ghi trùng ở đây", async () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const lines = captureConsole();
    expect((await apiError(new HttpError(401, "UNAUTHENTICATED", "x"))).status).toBe(401);
    await apiError(new HttpError(401, "INVALID_CREDENTIALS", "x"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "warn", event: "auth.access_denied", code: "UNAUTHENTICATED", status: 401 });
  });
});
