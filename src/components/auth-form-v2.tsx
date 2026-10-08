"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type AuthMode = "login" | "register" | "recover";

export function AuthFormV2({ mode, initialError = "" }: { mode: AuthMode; initialError?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  async function send(url: string, body: Record<string, FormDataEntryValue>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Không thể xử lý yêu cầu.");
      setMessage(result.message);
      if (result.next) {
        router.replace(result.next);
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(`/api/auth/${mode}`, Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  async function resendSignup() {
    if (!formRef.current) return;
    const body = Object.fromEntries(new FormData(formRef.current).entries());
    await send("/api/auth/resend-signup", body);
  }

  const title = mode === "login"
    ? "SIGN IN"
    : mode === "register"
      ? "SIGN UP"
      : "Khôi phục PIN";

  return <main className="page narrow"><div className="panel">
    <p className="eyebrow">Tài khoản cá nhân</p><h1 style={{fontSize:44}}>{title}</h1>
    {mode === "register" && <p className="muted">Bước 1: xác minh Gmail. Bạn sẽ tạo PIN 6 chữ số sau khi mở liên kết xác thực.</p>}
    <form ref={formRef} className="stack" onSubmit={submit}>
      <label>MSSV<input name="studentCode" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required autoComplete="username" placeholder="10 chữ số" /></label>
      {mode === "register" && <label>Gmail<input name="gmail" type="email" required autoComplete="email" placeholder="ten@gmail.com" /></label>}
      {mode === "login" && <label>PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="current-password" placeholder="6 chữ số" /></label>}
      <button className="primary" disabled={pending}>{pending ? "Đang xử lý…" : title}</button>
      {mode === "register" && <button type="button" className="secondary" disabled={pending} onClick={() => void resendSignup()}>Gửi lại email xác thực</button>}
    </form>
    {message && <p className="notice" aria-live="polite">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <p className="muted">{mode === "login"
      ? <><Link href="/auth/recover">Quên PIN?</Link> · <Link href="/register">Tạo tài khoản</Link></>
      : <Link href="/login">Quay lại SIGN IN</Link>}
    </p>
  </div></main>;
}
