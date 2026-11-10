"use client";

import { useState, type FormEvent } from "react";

export function OrganizationPinForm() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/organization/change-pin", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPin: raw.currentPin, newPin: raw.newPin }),
    });
    const result = await response.json() as { message?: string };
    setMessage(result.message ?? (response.ok ? "Đã đổi PIN." : "Không thể đổi PIN."));
    if (response.ok) event.currentTarget.reset();
  }
  return <form className="form-grid" onSubmit={(event) => void submit(event)}>
    {message && <p className="notice full">{message}</p>}
    <label>PIN hiện tại<input name="currentPin" type="password" inputMode="numeric" pattern="[0-9]{6}" required /></label>
    <label>PIN mới<input name="newPin" type="password" inputMode="numeric" pattern="[0-9]{6}" required /></label>
    <div className="full"><button className="primary">Đổi PIN tổ chức</button></div>
  </form>;
}
