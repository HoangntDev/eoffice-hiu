"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PinSetupForm({ mode }: { mode: "create" | "recover" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(mode === "create" ? "/api/auth/create-pin" : "/api/auth/reset-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Không thể lưu PIN.");
      router.replace(result.next ?? "/onboarding/profile");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu PIN.");
    } finally {
      setPending(false);
    }
  }

  return <form className="panel stack" onSubmit={submit}>
    <p className="muted">PIN phải gồm đúng 6 chữ số và không được chia sẻ cho người khác.</p>
    <label>PIN mới<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password" /></label>
    <label>Nhập lại PIN<input name="confirmPin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password" /></label>
    <button className="primary" disabled={pending}>{pending ? "Đang lưu…" : mode === "create" ? "Tạo PIN" : "Đặt lại PIN"}</button>
    {error && <p className="notice error" role="alert">{error}</p>}
  </form>;
}
