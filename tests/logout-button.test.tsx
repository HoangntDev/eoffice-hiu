// @vitest-environment jsdom
// #84: nút Đăng xuất không được kẹt ở "Đang đăng xuất…".

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "@/components/logout-button";

const replace = vi.fn();

beforeEach(() => {
  replace.mockReset();
  vi.stubGlobal("location", { ...window.location, replace });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function hangingFetch() {
  return vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }));
}

describe("LogoutButton (#84)", () => {
  it("máy chủ không trả lời: sau 8 giây vẫn chuyển về trang đăng nhập và hiện thông báo nhìn thấy được", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(screen.getByRole("button", { name: "Đang đăng xuất…" })).toBeDisabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(replace).toHaveBeenCalledWith("/login");
    const alert = screen.getByRole("alert");
    expect(alert).not.toHaveClass("sr-only");
    expect(alert).toHaveTextContent(/đăng xuất/i);
  });

  it("dùng next từ phản hồi (phiên tổ chức về /admin/login)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Đã đăng xuất.", next: "/admin/login" })));
    render(<LogoutButton />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" })); });
    expect(replace).toHaveBeenCalledWith("/admin/login");
  });

  it("phản hồi lỗi vẫn chuyển trang, không để người dùng kẹt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "INTERNAL" }, { status: 500 })));
    render(<LogoutButton />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" })); });
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.getByRole("alert")).not.toHaveClass("sr-only");
  });

  it("next lạ trong phản hồi bị bỏ qua (chống open redirect)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ next: "https://evil.example/login" })));
    render(<LogoutButton />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" })); });
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
