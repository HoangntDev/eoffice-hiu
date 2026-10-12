"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

/* ─────────────────────────────────────────────
   Register / Recover — single-step form (unchanged)
───────────────────────────────────────────── */
function SingleStepForm({ mode, initialError = "" }: { mode: "register" | "recover"; initialError?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  async function send(url: string, body: Record<string, FormDataEntryValue>) {
    setPending(true); setError(""); setMessage("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Không thể xử lý yêu cầu.");
      setMessage(result.message);
      if (result.next) { router.replace(result.next); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi xử lý."); }
    finally { setPending(false); }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await send(`/api/auth/${mode}`, Object.fromEntries(new FormData(e.currentTarget).entries()));
  }

  async function resendSignup() {
    if (!formRef.current) return;
    await send("/api/auth/resend-signup", Object.fromEntries(new FormData(formRef.current).entries()));
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">{mode === "register" ? "Tài khoản mới" : "Khôi phục PIN"}</p>
        <h1 className="auth-title">{mode === "register" ? "Tạo tài khoản" : "Quên PIN"}</h1>
        {mode === "register" && <p className="auth-desc">Bước 1: xác minh email sinh viên. Bạn sẽ tạo PIN 6 chữ số sau khi mở liên kết.</p>}
        <form ref={formRef} className="stack" style={{ marginTop: 20 }} onSubmit={submit}>
          <label>MSSV<input name="studentCode" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required autoComplete="username" placeholder="10 chữ số" /></label>
          {mode === "register" && <label>Email sinh viên HIU<input name="gmail" type="email" required autoComplete="email" placeholder="ten@student.hiu.vn" /></label>}
          <button className="primary" disabled={pending}>{pending ? "Đang xử lý…" : (mode === "register" ? "Gửi xác thực" : "Gửi link khôi phục")}</button>
          {mode === "register" && <button type="button" className="secondary" disabled={pending} onClick={() => void resendSignup()}>Gửi lại email xác thực</button>}
        </form>
        {message && <p className="notice" aria-live="polite">{message}</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        <p className="muted" style={{ marginTop: 14 }}><Link href="/login">← Quay lại đăng nhập</Link></p>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────
   PIN dot input — visual 6-circle input
───────────────────────────────────────────── */
function PinDots({ value, pending }: { value: string; pending: boolean }) {
  return (
    <div className="pin-dots" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={[
            "pin-dot",
            i < value.length ? "pin-dot--filled" : "",
            i === value.length && !pending ? "pin-dot--active" : "",
          ].filter(Boolean).join(" ")}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Login — two-step: MSSV → PIN
───────────────────────────────────────────── */
function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"mssv" | "pin">("mssv");
  const [studentCode, setStudentCode] = useState("");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const pinInputRef = useRef<HTMLInputElement>(null);

  /* Step 1: MSSV submit */
  function handleMssvSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(studentCode)) { setError("MSSV phải đúng 10 chữ số."); return; }
    setError("");
    setStep("pin");
    setTimeout(() => pinInputRef.current?.focus(), 60);
  }

  /* Step 2: PIN change → auto-submit at 6 digits */
  async function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(val);
    if (val.length === 6) await submitLogin(val);
  }

  async function submitLogin(pinValue: string) {
    setPending(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentCode, pin: pinValue }),
      });
      const result = await res.json();
      if (!res.ok) {
        setPin("");
        setTimeout(() => pinInputRef.current?.focus(), 60);
        throw new Error(result.message ?? "Không thể đăng nhập.");
      }
      if (result.next) { router.replace(result.next); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Lỗi xử lý."); }
    finally { setPending(false); }
  }

  /* ── Step 1: MSSV ── */
  if (step === "mssv") {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <p className="eyebrow">Đăng nhập hệ thống</p>
          <h1 className="auth-title">Nhập MSSV</h1>
          <p className="auth-desc">Mã số sinh viên 10 chữ số</p>
          <form onSubmit={handleMssvSubmit} className="stack" style={{ marginTop: 24 }}>
            <input
              name="studentCode"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              required
              autoFocus
              autoComplete="username"
              placeholder="Ví dụ: 2154010001"
              value={studentCode}
              onChange={(e) => { setStudentCode(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
              className="mssv-input"
            />
            <button className="primary" disabled={studentCode.length !== 10}>
              Tiếp tục
            </button>
          </form>
          {error && <p className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          <p className="muted" style={{ marginTop: 16 }}>
            <Link href="/register">Tạo tài khoản</Link>
            {" · "}
            <Link href="/auth/recover">Quên PIN?</Link>
          </p>
        </div>
      </main>
    );
  }

  /* ── Step 2: PIN ── */
  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Đăng nhập hệ thống</p>
        <h1 className="auth-title">Nhập PIN</h1>

        {/* MSSV badge with edit */}
        <div className="auth-mssv-badge">
          <span className="auth-mssv-code">{studentCode}</span>
          <button
            type="button"
            className="auth-mssv-edit"
            onClick={() => { setStep("mssv"); setPin(""); setError(""); }}
          >
            Sửa
          </button>
        </div>

        {/* 6-dot PIN area — click anywhere to focus hidden input */}
        <div
          className="pin-wrap"
          onClick={() => pinInputRef.current?.focus()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pinInputRef.current?.focus(); }}
          role="button"
          tabIndex={-1}
          aria-label="Vùng nhập PIN"
        >
          <PinDots value={pin} pending={pending} />
          {/* Hidden input — captures numeric keyboard on mobile & desktop */}
          <input
            ref={pinInputRef}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={handlePinChange}
            maxLength={6}
            disabled={pending}
            autoFocus
            autoComplete="current-password"
            aria-label="PIN 6 chữ số"
            className="pin-hidden-input"
          />
        </div>

        <p className="auth-pin-hint">{pending ? "Đang xác thực…" : "PIN 6 chữ số · tự động đăng nhập"}</p>

        {error && <p className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</p>}

        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/auth/recover">Quên PIN?</Link>
        </p>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────
   Export
───────────────────────────────────────────── */
export function AuthFormV2({ mode, initialError = "" }: { mode: "login" | "register" | "recover"; initialError?: string }) {
  if (mode === "login") return <LoginForm initialError={initialError} />;
  return <SingleStepForm mode={mode} initialError={initialError} />;
}
