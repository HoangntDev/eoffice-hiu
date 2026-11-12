"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { LoginUnitGroup } from "@/modules/organization-auth/display";

type Props =
  | { step: "organization"; groups: LoginUnitGroup[] }
  | { step: "officer"; groups?: never };

function PinDots({ value, pending }: { value: string; pending: boolean }) {
  return (
    <div className="pin-dots" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={index}
          className={[
            "pin-dot",
            index < value.length ? "pin-dot--filled" : "",
            index === value.length && !pending ? "pin-dot--active" : "",
          ].filter(Boolean).join(" ")}
        />
      ))}
    </div>
  );
}

export function OrganizationLoginForm(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [organizationPin, setOrganizationPin] = useState("");
  const [officerPin, setOfficerPin] = useState("");
  const organizationPinRef = useRef<HTMLInputElement>(null);
  const officerPinRef = useRef<HTMLInputElement>(null);

  function changeOrganizationPin(event: ChangeEvent<HTMLInputElement>) {
    setOrganizationPin(event.target.value.replace(/\D/g, "").slice(0, 6));
    setError("");
  }

  function changeOfficerPin(event: ChangeEvent<HTMLInputElement>) {
    setOfficerPin(event.target.value.replace(/\D/g, "").slice(0, 6));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const body = props.step === "organization"
      ? { organizationId: raw.organizationId, organizationPin: raw.organizationPin }
      : { studentCode: raw.studentCode, pin: raw.pin };
    try {
      const response = await fetch(`/api/auth/organization/${props.step === "organization" ? "start" : "officer"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { next?: string; message?: string };
      if (!response.ok || !result.next) throw new Error(result.message ?? "Không thể đăng nhập tài khoản tổ chức.");
      router.replace(result.next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập tài khoản tổ chức.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={(event) => void submit(event)}>
      <p className="eyebrow">Đăng nhập quản trị</p>
      <h1>{props.step === "organization" ? "Tài khoản tổ chức" : "Xác nhận cán bộ"}</h1>
      <p className="lead">
        {props.step === "organization"
          ? "Bước 1/2: chọn đơn vị và nhập PIN tổ chức."
          : "Bước 2/2: nhập MSSV và PIN cá nhân của cán bộ đang thao tác."}
      </p>
      {error && <p className="notice error" role="alert">{error}</p>}
      {props.step === "organization" ? (
        <>
          <label>Đơn vị
            <select name="organizationId" required defaultValue="">
              <option value="" disabled>Chọn đơn vị</option>
              {props.groups.map((group) => (
                <optgroup key={group.level} label={group.label}>
                  {group.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label htmlFor="organization-pin">PIN tổ chức</label>
          <div
            className="pin-wrap"
            onClick={() => organizationPinRef.current?.focus()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") organizationPinRef.current?.focus();
            }}
            role="button"
            tabIndex={-1}
            aria-label="Vùng nhập PIN tổ chức"
          >
            <PinDots value={organizationPin} pending={busy} />
            <input
              ref={organizationPinRef}
              id="organization-pin"
              name="organizationPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="current-password"
              aria-label="PIN tổ chức"
              className="pin-hidden-input"
              value={organizationPin}
              onChange={changeOrganizationPin}
              disabled={busy}
              required
            />
          </div>
        </>
      ) : (
        <>
          <label>MSSV cán bộ
            <input name="studentCode" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} autoComplete="username" required />
          </label>
          <label htmlFor="officer-pin">PIN cá nhân</label>
          <div
            className="pin-wrap"
            onClick={() => officerPinRef.current?.focus()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") officerPinRef.current?.focus();
            }}
            role="button"
            tabIndex={-1}
            aria-label="Vùng nhập PIN cá nhân"
          >
            <PinDots value={officerPin} pending={busy} />
            <input
              ref={officerPinRef}
              id="officer-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="current-password"
              aria-label="PIN cá nhân"
              className="pin-hidden-input"
              value={officerPin}
              onChange={changeOfficerPin}
              disabled={busy}
              required
            />
          </div>
        </>
      )}
      <button className="primary" disabled={busy}>{busy ? "Đang xác thực…" : "Tiếp tục"}</button>
    </form>
  );
}
