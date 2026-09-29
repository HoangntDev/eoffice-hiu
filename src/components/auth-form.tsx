"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" | "recover" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch(`/api/auth/${mode}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Không thể xử lý yêu cầu.");
      setMessage(result.message); if (mode === "login") router.push("/onboarding/profile");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu."); }
    finally { setPending(false); }
  }

  const title = mode === "login" ? "Đăng nhập bằng MSSV" : mode === "register" ? "Tạo tài khoản sinh viên" : "Khôi phục mật khẩu";
  return <main className="page narrow"><div className="panel">
    <p className="eyebrow">Tài khoản cá nhân</p><h1 style={{fontSize:44}}>{title}</h1>
    <form className="stack" onSubmit={submit}>
      <label>MSSV<input name="studentCode" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required autoComplete="username" placeholder="10 chữ số" /></label>
      {mode === "register" && <label>Gmail<input name="gmail" type="email" required autoComplete="email" placeholder="ten@gmail.com" /></label>}
      {mode !== "recover" && <label>Mật khẩu<input name="password" type="password" minLength={6} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}
      <button className="primary" disabled={pending}>{pending ? "Đang xử lý…" : title}</button>
    </form>
    {message && <p className="notice" aria-live="polite">{message}</p>}{error && <p className="notice error" role="alert">{error}</p>}
    <p className="muted">{mode === "login" ? <><Link href="/auth/recover">Quên mật khẩu?</Link> · <Link href="/register">Tạo tài khoản</Link></> : <Link href="/login">Quay lại đăng nhập</Link>}</p>
  </div></main>;
}
