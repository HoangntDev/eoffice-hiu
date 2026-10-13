// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("SIGN UP asks for MSSV and student email, but not a PIN", () => {
    render(<AuthFormV2 mode="register" />);
    expect(screen.getByLabelText("MSSV")).toBeRequired();
    expect(screen.getByLabelText("Email sinh viên HIU")).toBeRequired();
    expect(screen.queryByLabelText(/PIN/)).toBeNull();
    expect(screen.getByRole("button", { name: "Gửi lại email xác thực" })).toBeEnabled();
  });

  it("SIGN IN asks for a 10-digit MSSV first, then a six-digit PIN, never an email", () => {
    render(<AuthFormV2 mode="login" />);
    const mssv = screen.getByPlaceholderText(/2154010001/);
    expect(mssv).toBeRequired();
    expect(mssv).toHaveAttribute("pattern", "[0-9]{10}");
    expect(screen.queryByLabelText(/PIN/)).toBeNull();
    expect(screen.queryByLabelText(/[Ee]mail/)).toBeNull();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();

    fireEvent.change(mssv, { target: { value: "2154010001" } });
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    const pin = screen.getByLabelText("PIN 6 chữ số");
    expect(pin).toHaveAttribute("maxlength", "6");
    expect(pin).toHaveAttribute("inputmode", "numeric");
    expect(screen.queryByLabelText(/[Ee]mail/)).toBeNull();
  });

  it("PIN setup requires confirmation and account security requires the current PIN first", () => {
    const { unmount } = render(<PinSetupForm mode="create" />);
    expect(screen.getByLabelText("PIN 6 chữ số")).toHaveAttribute("maxlength", "6");
    expect(screen.getByLabelText("Nhập lại PIN")).toBeDisabled();
    unmount();

    render(<AccountSecurityPanel />);
    expect(screen.getByLabelText("PIN hiện tại")).toBeEnabled();
    expect(screen.getByLabelText("PIN mới")).toBeDisabled();
    expect(screen.getByLabelText("Nhập lại PIN mới")).toBeDisabled();
  });

  it("shows a clear SIGN OUT control", () => {
    render(<LogoutButton />);
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeEnabled();
  });
});
