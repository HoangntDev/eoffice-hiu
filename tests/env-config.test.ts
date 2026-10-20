import { afterEach, describe, expect, it, vi } from "vitest";
import { logLevel, optionalPublicSupabaseEnv } from "@/lib/env";
import { logEvent } from "@/lib/log";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("logLevel", () => {
  it("dùng LOG_LEVEL khi hợp lệ, không phân biệt hoa thường", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", " DEBUG ");
    expect(logLevel()).toBe("debug");
  });

  it.each([
    ["production", "info"],
    ["development", "debug"],
    ["test", "warn"],
  ])("mặc định theo NODE_ENV=%s là %s khi LOG_LEVEL trống hoặc sai", (env, expected) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("LOG_LEVEL", "");
    expect(logLevel()).toBe(expected);
    vi.stubEnv("LOG_LEVEL", "verbose");
    expect(logLevel()).toBe(expected);
  });
});

describe("logEvent", () => {
  it("bỏ dòng dưới mức LOG_LEVEL và ghi JSON cho dòng đạt mức", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logEvent("info", "bo_qua");
    logEvent("warn", "ghi_lai", { requestId: "abc" });
    expect(info).not.toHaveBeenCalled();
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({ level: "warn", event: "ghi_lai", requestId: "abc" });
  });
});

describe("optionalPublicSupabaseEnv", () => {
  it("trả null khi thiếu URL hoặc key, không ném lỗi", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "k");
    expect(optionalPublicSupabaseEnv()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(optionalPublicSupabaseEnv()).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "k" });
  });
});
