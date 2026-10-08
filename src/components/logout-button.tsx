"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("SIGN_OUT_FAILED");
      window.location.replace("/login");
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return <span>
    <button type="button" className="nav-button" disabled={pending} onClick={() => void logout()}>
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
    {error ? <span className="sr-only" role="alert">{error}</span> : null}
  </span>;
}
