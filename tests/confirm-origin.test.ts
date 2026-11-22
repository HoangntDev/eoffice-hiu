import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { handleConfirmation } from "@/app/auth/confirm-handler";

vi.mock("@/lib/supabase/server", () => ({
  createUserSupabase: () => ({
    auth: { exchangeCodeForSession: async () => ({ data: { user: { id: "demo", email: "demo@student.hiu.vn" } }, error: null }) },
  }),
  createAdminSupabase: () => ({ rpc: async () => ({ error: null }) }),
}));

afterEach(() => vi.unstubAllEnvs());

it("giữ origin công khai chứa cookie phiên khi chuyển từ email đăng ký sang tạo PIN", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3992");
  const request = new NextRequest("http://localhost:3992/auth/confirm?flow=signup&code=fixture");
  const response = await handleConfirmation(request);
  expect(response.headers.get("location")).toBe("http://127.0.0.1:3992/signup/create-pin");
});
