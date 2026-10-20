import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN, loginPathFor, safeNextPath } from "@/lib/auth/next-path";
import { loginSchema } from "@/modules/auth-account/schemas";

// K1 (Bug #28): quét QR khi chưa đăng nhập phải quay lại đúng link có ?t= sau khi đăng nhập.
const qrPath = "/attend/21f3568e-7580-487a-805c-45888d0f65c8?t=21f3568e-7580-487a-805c-45888d0f65c8.1.1792484892043.0123456789abcdef0123456789abcdef";

describe("loginPathFor (proxy)", () => {
  it("giữ query string ?t= trong tham số next", () => {
    const [pathname, search] = [qrPath.slice(0, qrPath.indexOf("?")), qrPath.slice(qrPath.indexOf("?"))];
    const login = new URL(loginPathFor(pathname, search), "http://localhost");
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("next")).toBe(qrPath);
  });

  it("không thêm dấu ? khi không có query string", () => {
    expect(loginPathFor("/programs", "")).toBe("/login?next=%2Fprograms");
  });
});

describe("safeNextPath", () => {
  it("trả lại đúng đường dẫn nội bộ kèm query", () => {
    expect(safeNextPath(qrPath)).toBe(qrPath);
    expect(safeNextPath("/programs/abc?tab=1#x")).toBe("/programs/abc?tab=1");
  });

  it.each([
    ["undefined", undefined],
    ["chuỗi rỗng", ""],
    ["URL tuyệt đối", "https://evil.example/attend"],
    ["protocol-relative", "//evil.example/attend"],
    ["dấu gạch ngược", "/\\evil.example"],
    ["scheme javascript", "javascript:alert(1)"],
    ["không bắt đầu bằng /", "attend/abc"],
    ["ký tự điều khiển", "/attend\n/x"],
    ["quay về /login", "/login?next=/x"],
    ["gọi API", "/api/auth/logout"],
    ["quá dài", `/${"a".repeat(2050)}`],
  ])("dùng mặc định khi next là %s", (_label, value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("cho phép đổi giá trị mặc định (trang login dùng chuỗi rỗng)", () => {
    expect(safeNextPath("https://evil.example", "")).toBe("");
  });
});

describe("loginSchema", () => {
  it("nhận next tùy chọn và vẫn chặn trường lạ", () => {
    expect(loginSchema.parse({ studentCode: "2211110102", pin: "123456", next: qrPath }).next).toBe(qrPath);
    expect(loginSchema.parse({ studentCode: "2211110102", pin: "123456" }).next).toBeUndefined();
    expect(() => loginSchema.parse({ studentCode: "2211110102", pin: "123456", redirect: "/x" })).toThrow();
  });
});
