// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSecurityPanel } from "@/components/account-security-panel";
import { AuthFormV2 } from "@/components/auth-form-v2";
import { LogoutButton } from "@/components/logout-button";
import { PinSetupForm } from "@/components/pin-setup-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("independent account flows", () => {
  it("SIGN UP asks for MSSV and Gmail, but not a PIN", () => {
    render(<AuthFormV2 mode="register" />);
    expect(screen.getByLabelText("MSSV")).toBeRequired();
    expect(screen.getByLabelText("Gmail")).toBeRequired();
    expect(screen.queryByLabelText("PIN")).toBeNull();
    expect(screen.getByRole("button", { name: "Gửi lại email xác thực" })).toBeEnabled();
  });

  it("SIGN IN asks for MSSV and an exact six-digit PIN, but not Gmail", () => {
    render(<AuthFormV2 mode="login" />);
    const pin = screen.getByLabelText("PIN");
    expect(screen.getByLabelText("MSSV")).toBeRequired();
    expect(pin).toHaveAttribute("pattern", "[0-9]{6}");
    expect(pin).toHaveAttribute("maxlength", "6");
    expect(screen.queryByLabelText("Gmail")).toBeNull();
  });

  it("PIN setup requires confirmation and account security requires the current PIN", () => {
    const { unmount } = render(<PinSetupForm mode="create" />);
    expect(screen.getByLabelText("PIN mới")).toBeRequired();
    expect(screen.getByLabelText("Nhập lại PIN")).toBeRequired();
    unmount();

    render(<AccountSecurityPanel />);
    expect(screen.getByLabelText("PIN hiện tại")).toBeRequired();
    expect(screen.getByLabelText("PIN mới")).toBeRequired();
    expect(screen.getByLabelText("Nhập lại PIN mới")).toBeRequired();
  });

  it("shows a clear SIGN OUT control", () => {
    render(<LogoutButton />);
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeEnabled();
  });
});
