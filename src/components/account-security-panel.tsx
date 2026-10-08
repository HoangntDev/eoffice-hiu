"use client";

import { useState, type FormEvent } from "react";

export function AccountSecurityPanel({ initialMessage = "" }: { initialMessage?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, url: string) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    const form = event.currentTarget;
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Không thể cập nhật.");
      setMessage(result.message);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật.");
    } finally {
      setPending(false);
    }
  }

  return <div className="stack">
    {message && <p className="notice" aria-live="polite">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <section className="panel">
      <h2>Đổi Gmail</h2>
      <p className="muted">Gmail hiện tại chỉ được thay sau khi Gmail mới hoàn tất xác minh.</p>
      <form className="inline" onSubmit={(event) => void submit(event, "/api/account/email")}>
        <label style={{flex:1}}>Gmail mới<input name="gmail" type="email" required autoComplete="email" placeholder="ten@gmail.com" /></label>
        <button className="primary" disabled={pending}>Gửi xác minh</button>
      </form>
    </section>
    <section className="panel">
      <h2>Đổi PIN</h2>
      <form className="stack" onSubmit={(event) => void submit(event, "/api/account/pin")}>
        <label>PIN hiện tại<input name="currentPin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="current-password" /></label>
        <label>PIN mới<input name="newPin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password" /></label>
        <label>Nhập lại PIN mới<input name="confirmPin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="new-password" /></label>
        <button className="primary" disabled={pending}>Đổi PIN</button>
      </form>
    </section>
  </div>;
}
