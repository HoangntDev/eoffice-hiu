// #84 đăng xuất kẹt / không kết thúc phiên cán bộ; #85 cookie của phiên đã bị thu hồi gây 500.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  cookieSetThrows: false,
  claims: null as Record<string, unknown> | null,
  accountType: "student" as string | null,
  accountStatus: "active",
  signOut: null as unknown as (...args: unknown[]) => Promise<unknown>,
  adminRpc: null as unknown as (...args: unknown[]) => Promise<unknown>,
  getUserResult: { data: { user: null }, error: null } as { data: { user: { id: string } | null }; error: unknown },
  capturedCookieOptions: [] as { setAll: (cookies: { name: string; value: string; options?: object }[]) => void }[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => state.cookies,
    get: (name: string) => state.cookies.find((cookie) => cookie.name === name),
    set: () => {
      if (state.cookieSetThrows) throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    },
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));

function query(result: () => unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "limit"]) chain[method] = () => chain;
  chain.maybeSingle = async () => result();
  chain.single = async () => result();
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return chain;
}

const accountRow = () => ({
  data: state.accountType ? { account_type: state.accountType, status: state.accountStatus, student_code: "2211110101" } : null,
  error: null,
});

// Client Supabase giả cho cả @supabase/ssr (proxy, createUserSupabase) và route handler. Không gọi mạng.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (c: { name: string; value: string; options?: object }[]) => void } }) => {
    state.capturedCookieOptions.push(options.cookies);
    return {
      auth: {
        getClaims: async () => ({ data: state.claims ? { claims: state.claims } : null, error: null }),
        getUser: async () => state.getUserResult,
        signOut: (...args: unknown[]) => state.signOut(...args),
      },
      from: () => query(accountRow),
      rpc: async () => ({ data: true, error: null }),
    };
  },
}));

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return {
    ...actual,
    createClient: () => ({
      from: () => query(accountRow),
      rpc: (...args: unknown[]) => state.adminRpc(...args),
      auth: { admin: {} },
    }),
  };
});

import { setLogSink } from "@/lib/log";
import { createUserSupabase } from "@/lib/supabase/server";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { proxy } from "@/proxy";

const SESSION_COOKIE = { name: "sb-127-auth-token", value: "base64-session-cookie-value" };
const VERIFIER_COOKIE = { name: "sb-127-auth-token-code-verifier", value: "verifier-value" };
// Route nhận Request (requestId cho log); gọi qua kiểu chung để test không phụ thuộc chữ ký cũ.
const logout = logoutRoute as unknown as (request: Request) => Promise<Response>;
const logs: string[] = [];

function locationPath(response: Response): string {
  const url = new URL(response.headers.get("location") ?? "", "http://placeholder.invalid");
  return url.pathname + url.search;
}

function expiredCookieNames(response: Response): string[] {
  const header = response.headers.get("set-cookie") ?? "";
  return header
    .split(/,(?=\s*[^;,=\s]+=)/)
    .filter((part) => /max-age=0/i.test(part) || /expires=Thu, 01 Jan 1970/i.test(part))
    .map((part) => part.trim().split("=")[0]);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-value");
  vi.stubEnv("LOG_LEVEL", "debug");
  state.cookies = [SESSION_COOKIE, VERIFIER_COOKIE];
  state.cookieSetThrows = false;
  state.claims = { sub: "student-user-id", session_id: "11111111-1111-4111-8111-111111111111" };
  state.accountType = "student";
  state.accountStatus = "active";
  state.signOut = vi.fn(async () => ({ error: null }));
  state.adminRpc = vi.fn(async () => ({ data: null, error: null }));
  state.getUserResult = { data: { user: { id: "student-user-id" } }, error: null };
  state.capturedCookieOptions = [];
  logs.length = 0;
  setLogSink((_level, line) => { logs.push(line); });
});

afterEach(() => {
  setLogSink(undefined);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const logoutRequest = () => new Request("http://127.0.0.1:3000/api/auth/logout", { method: "POST" });

describe("#84 – POST /api/auth/logout", () => {
  it("không trả Clear-Site-Data (gây treo request trên Chromium), giữ Cache-Control no-store", async () => {
    const response = await logout(logoutRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("clear-site-data")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("phiên sinh viên: signOut scope local, xóa mọi cookie sb-*, trả next=/login", async () => {
    const response = await logout(logoutRequest());
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await response.json()).toMatchObject({ next: "/login" });
    expect(expiredCookieNames(response)).toEqual(expect.arrayContaining([SESSION_COOKIE.name, VERIFIER_COOKIE.name]));
    expect(state.adminRpc).not.toHaveBeenCalledWith("end_officer_session", expect.anything());
  });

  it("phiên tổ chức: gọi end_officer_session trước signOut và trả next=/admin/login", async () => {
    state.accountType = "organization";
    state.claims = { sub: "org-account-id", session_id: "22222222-2222-4222-8222-222222222222" };
    const order: string[] = [];
    state.adminRpc = vi.fn(async (name: unknown) => { order.push(String(name)); return { data: null, error: null }; });
    state.signOut = vi.fn(async () => { order.push("signOut"); return { error: null }; });

    const response = await logout(logoutRequest());

    expect(state.adminRpc).toHaveBeenCalledWith("end_officer_session", { p_session_id: "22222222-2222-4222-8222-222222222222" });
    expect(order).toEqual(["end_officer_session", "signOut"]);
    expect(await response.json()).toMatchObject({ next: "/admin/login" });
  });

  it("signOut lỗi hoặc ném lỗi (Auth không trả lời) vẫn trả 200 và xóa cookie sb-*", async () => {
    state.signOut = vi.fn(async () => { throw new Error("fetch failed"); });
    const response = await logout(logoutRequest());
    expect(response.status).toBe(200);
    expect(expiredCookieNames(response)).toContain(SESSION_COOKIE.name);

    state.signOut = vi.fn(async () => ({ error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } }));
    const second = await logout(logoutRequest());
    expect(second.status).toBe(200);
    expect(expiredCookieNames(second)).toContain(SESSION_COOKIE.name);
  });

  it("ghi log auth.logout có kết quả, không ghi giá trị cookie/token", async () => {
    await logout(logoutRequest());
    const line = logs.map((entry) => JSON.parse(entry)).find((entry) => entry.event === "auth.logout");
    expect(line).toMatchObject({ event: "auth.logout", result: "ok", accountType: "student" });
    const all = logs.join("\n");
    expect(all).not.toContain(SESSION_COOKIE.value);
    expect(all).not.toContain(VERIFIER_COOKIE.value);
  });
});

describe("#85 – cookie của phiên đã bị thu hồi", () => {
  const revoked = { data: { user: null }, error: { name: "AuthApiError", status: 403, code: "session_not_found", message: "Session not found" } };

  function requestWithCookie(path: string) {
    return new NextRequest(`http://127.0.0.1:3000${path}`, { headers: { cookie: `${SESSION_COOKIE.name}=${SESSION_COOKIE.value}` } });
  }

  it("trang cần đăng nhập: chuyển về /login?next=…, xóa cookie sb-*, không 500", async () => {
    state.getUserResult = revoked;
    const response = await proxy(requestWithCookie("/programs"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/login?next=%2Fprograms");
    expect(expiredCookieNames(response)).toContain(SESSION_COOKIE.name);
  });

  it("khu /admin: chuyển về /admin/login và xóa cookie", async () => {
    state.getUserResult = revoked;
    const response = await proxy(requestWithCookie("/admin/payments"));
    expect(response.status).toBe(307);
    expect(locationPath(response)).toBe("/admin/login");
    expect(expiredCookieNames(response)).toContain(SESSION_COOKIE.name);
  });

  it("trang công khai (/login): cho đi tiếp nhưng xóa cookie để trang render như khách", async () => {
    state.getUserResult = revoked;
    const response = await proxy(requestWithCookie("/login"));
    expect(response.status).toBe(200);
    expect(expiredCookieNames(response)).toContain(SESSION_COOKIE.name);
  });

  it("Auth không gọi được (lỗi hạ tầng) vẫn trả 503, không coi là chưa đăng nhập", async () => {
    state.getUserResult = { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } };
    const response = await proxy(requestWithCookie("/programs"));
    expect(response.status).toBe(503);
    expect(expiredCookieNames(response)).not.toContain(SESSION_COOKIE.name);
  });

  it("Server Component: ghi cookie bị Next chặn không làm trang lỗi 500", async () => {
    state.cookieSetThrows = true;
    await createUserSupabase();
    const options = state.capturedCookieOptions.at(-1)!;
    expect(() => options.setAll([{ name: SESSION_COOKIE.name, value: "", options: { maxAge: 0 } }])).not.toThrow();
  });
});
