"use client";

import { useState } from "react";

// Quá thời gian này mà máy chủ chưa trả lời thì vẫn rời trang (#84): nút không bao giờ kẹt.
const LOGOUT_TIMEOUT_MS = 8_000;
const ALLOWED_NEXT = new Set(["/login", "/admin/login"]);

type Props = { fallbackNext?: "/login" | "/admin/login" };

export function LogoutButton({ fallbackNext = "/login" }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
    let next: string = fallbackNext;
    let failed = false;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store", signal: controller.signal });
      const body = await response.json().catch(() => null) as { next?: unknown } | null;
      if (!response.ok) failed = true;
      if (typeof body?.next === "string" && ALLOWED_NEXT.has(body.next)) next = body.next;
    } catch {
      failed = true;
    } finally {
      clearTimeout(timer);
    }
    if (failed) setError("Máy chủ chưa xác nhận đăng xuất. Đang chuyển về trang đăng nhập…");
    window.location.replace(next);
  }

  return <span>
    <button type="button" className="nav-button" disabled={pending} onClick={() => void logout()}>
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
    {error ? <span className="notice error" role="alert">{error}</span> : null}
  </span>;
}
