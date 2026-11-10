"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { LoginUnitGroup } from "@/modules/organization-auth/display";

type Props =
  | { step: "organization"; groups: LoginUnitGroup[] }
  | { step: "officer"; groups?: never };

export function OrganizationLoginForm(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
          <label>PIN tổ chức
            <input name="organizationPin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" required />
          </label>
        </>
      ) : (
        <>
          <label>MSSV cán bộ
            <input name="studentCode" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} autoComplete="username" required />
          </label>
          <label>PIN cá nhân
            <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" required />
          </label>
        </>
      )}
      <button className="primary" disabled={busy}>{busy ? "Đang xác thực…" : "Tiếp tục"}</button>
    </form>
  );
}
