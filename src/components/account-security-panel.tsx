"use client";

import { useRef, useState } from "react";

/* ── PIN dot display ── */
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

type PinStep = "current" | "new" | "confirm";

const STEP_LABEL: Record<PinStep, string> = {
  current: "Nhập PIN hiện tại",
  new: "Nhập PIN mới",
  confirm: "Nhập lại PIN mới",
};
const STEP_HINT: Record<PinStep, string> = {
  current: "PIN 6 chữ số · tự động sang bước tiếp",
  new: "PIN 6 chữ số mới · tự động sang bước tiếp",
  confirm: "Nhập lại PIN mới · tự động xác nhận",
};

/* ── Change PIN sub-form ── */
function ChangePinForm() {
  const [step, setStep] = useState<PinStep>("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const refs: Record<PinStep, React.RefObject<HTMLInputElement | null>> = {
    current: currentRef, new: newRef, confirm: confirmRef,
  };
  const activeValue = step === "current" ? currentPin : step === "new" ? newPin : confirmPin;

  function focusActive() { refs[step].current?.focus(); }

  function reset(toStep: PinStep = "current") {
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
    setStep(toStep);
    setTimeout(() => refs[toStep].current?.focus(), 60);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void, next: PinStep | null) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setter(val);
    setError("");
    if (val.length === 6 && next === "new") {
      void verifyCurrentPin(val);
    } else if (val.length === 6 && next) {
      setStep(next);
      setTimeout(() => refs[next].current?.focus(), 60);
    } else if (val.length === 6 && !next) {
      void doSubmit(currentPin, newPin, val);
    }
  }

  async function verifyCurrentPin(pin: string) {
    setPending(true); setError("");
    try {
      const res = await fetch("/api/account/verify-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "PIN không đúng.");
      setStep("new");
      setTimeout(() => newRef.current?.focus(), 60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PIN không đúng.");
      setCurrentPin("");
      setTimeout(() => currentRef.current?.focus(), 60);
    } finally {
      setPending(false);
    }
  }

  async function doSubmit(cp: string, np: string, cnp: string) {
    if (np !== cnp) {
      setError("Hai lần nhập PIN mới không khớp.");
      reset("new");
      return;
    }
    if (cp === np) {
      setError("PIN mới phải khác PIN hiện tại.");
      reset("new");
      return;
    }
    setPending(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/account/pin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPin: cp, newPin: np, confirmPin: cnp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Không thể đổi PIN.");
      setMessage(result.message ?? "Đã đổi PIN thành công.");
      reset("current");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi PIN.");
      reset("current");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel">
      <h2>Đổi PIN</h2>
      <p className="auth-desc" style={{ marginBottom: 4 }}>{STEP_LABEL[step]}</p>

      <div
        className="pin-wrap"
        style={{ paddingTop: 20, paddingBottom: 4 }}
        onClick={focusActive}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") focusActive(); }}
        role="button"
        tabIndex={-1}
        aria-label="Vùng nhập PIN"
      >
        <PinDots value={activeValue} pending={pending} />

        <input ref={currentRef} type="password" inputMode="numeric" value={currentPin}
          onChange={(e) => handleChange(e, setCurrentPin, "new")}
          maxLength={6} disabled={pending || step !== "current"}
          autoComplete="current-password" aria-label="PIN hiện tại" className="pin-hidden-input" />
        <input ref={newRef} type="password" inputMode="numeric" value={newPin}
          onChange={(e) => handleChange(e, setNewPin, "confirm")}
          maxLength={6} disabled={pending || step !== "new"}
          autoComplete="new-password" aria-label="PIN mới" className="pin-hidden-input" />
        <input ref={confirmRef} type="password" inputMode="numeric" value={confirmPin}
          onChange={(e) => handleChange(e, setConfirmPin, null)}
          maxLength={6} disabled={pending || step !== "confirm"}
          autoComplete="new-password" aria-label="Nhập lại PIN mới" className="pin-hidden-input" />
      </div>

      <p className="auth-pin-hint">{pending ? "Đang lưu…" : STEP_HINT[step]}</p>

      {step !== "current" && !pending && (
        <button type="button" className="auth-mssv-edit" style={{ marginTop: 8, display: "block" }}
          onClick={() => reset("current")}>
          ← Bắt đầu lại
        </button>
      )}

      {message && <p className="notice" aria-live="polite" style={{ marginTop: 12 }}>{message}</p>}
      {error && <p className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </section>
  );
}

/* ── Main export ── */
export function AccountSecurityPanel() {
  return <ChangePinForm />;
}
