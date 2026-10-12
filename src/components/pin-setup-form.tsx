"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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

export function PinSetupForm({ mode }: { mode: "create" | "recover" }) {
  const router = useRouter();
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const enterRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(val);
    setError("");
    if (val.length === 6) {
      setStep("confirm");
      setTimeout(() => confirmRef.current?.focus(), 60);
    }
  }

  async function handleConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setConfirmPin(val);
    setError("");
    if (val.length === 6) await submit(pin, val);
  }

  async function submit(pinValue: string, confirmValue: string) {
    if (pinValue !== confirmValue) {
      setError("Hai lần nhập PIN không khớp. Hãy thử lại.");
      setPin("");
      setConfirmPin("");
      setStep("enter");
      setTimeout(() => enterRef.current?.focus(), 60);
      return;
    }
    setPending(true);
    setError("");
    try {
      const endpoint = mode === "create" ? "/api/auth/create-pin" : "/api/auth/reset-pin";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: pinValue, confirmPin: confirmValue }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Không thể lưu PIN.");
      router.replace(result.next ?? "/onboarding/profile");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu PIN.");
      setPin("");
      setConfirmPin("");
      setStep("enter");
      setTimeout(() => enterRef.current?.focus(), 60);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <p className="eyebrow">{mode === "create" ? "Tạo tài khoản" : "Khôi phục PIN"}</p>
      <h1 className="auth-title">{step === "enter" ? "Tạo PIN" : "Nhập lại PIN"}</h1>
      <p className="auth-desc">
        {step === "enter" ? "Chọn PIN 6 chữ số" : "Nhập lại PIN để xác nhận"}
      </p>

      <div
        className="pin-wrap"
        onClick={() => (step === "enter" ? enterRef : confirmRef).current?.focus()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (step === "enter" ? enterRef : confirmRef).current?.focus(); }}
        role="button"
        tabIndex={-1}
        aria-label="Vùng nhập PIN"
      >
        <PinDots value={step === "enter" ? pin : confirmPin} pending={pending} />

        <input
          ref={enterRef}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={handlePinChange}
          maxLength={6}
          disabled={pending || step !== "enter"}
          autoFocus={step === "enter"}
          autoComplete="new-password"
          aria-label="PIN 6 chữ số"
          className="pin-hidden-input"
        />
        <input
          ref={confirmRef}
          type="password"
          inputMode="numeric"
          value={confirmPin}
          onChange={handleConfirmChange}
          maxLength={6}
          disabled={pending || step !== "confirm"}
          autoComplete="new-password"
          aria-label="Nhập lại PIN"
          className="pin-hidden-input"
        />
      </div>

      <p className="auth-pin-hint">
        {pending ? "Đang lưu…" : step === "enter" ? "PIN 6 chữ số · tự động sang bước tiếp" : "Nhập lại PIN · tự động xác nhận"}
      </p>

      {error && <p className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</p>}

      {step === "confirm" && !pending && (
        <button
          type="button"
          className="auth-mssv-edit"
          style={{ marginTop: 12, display: "block" }}
          onClick={() => { setPin(""); setConfirmPin(""); setStep("enter"); setTimeout(() => enterRef.current?.focus(), 60); }}
        >
          ← Nhập lại từ đầu
        </button>
      )}
    </div>
  );
}
