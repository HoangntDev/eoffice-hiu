"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type OrganizationAccountRow = {
  userId: string;
  organizationId: string;
  organizationName: string;
  unitType: string;
  status: string;
};

type Props = {
  accounts: OrganizationAccountRow[];
  organizationAccountsEnabled: boolean;
  paymentEnabled: boolean;
};

export function OrganizationAccountsConsole({ accounts, organizationAccountsEnabled, paymentEnabled }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function manage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/admin/accounts", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(raw),
    });
    const result = await response.json() as { message?: string };
    setMessage(result.message ?? "Không thể cập nhật tài khoản.");
    if (response.ok) router.refresh();
  }

  async function toggle(key: "ORG_ACCOUNTS_ENABLED" | "PAYMENT_ENABLED", enabled: boolean) {
    const payment = key === "PAYMENT_ENABLED";
    const response = await fetch("/api/admin/feature-flag", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key,
        enabled: !enabled,
        reason: enabled
          ? payment ? "Tắt thanh toán Đoàn phí" : "Tắt để quay về cách quản lý v1.0.0"
          : payment ? "Bật thanh toán Đoàn phí" : "Bật tài khoản tổ chức",
      }),
    });
    const result = await response.json() as { message?: string };
    setMessage(result.message ?? "Không thể đổi công tắc.");
    if (response.ok) router.refresh();
  }

  return <>
    {message && <p className="notice">{message}</p>}
    <section className="panel">
      <h2>Công tắc tài khoản tổ chức</h2>
      <p>Trạng thái database: <strong>{organizationAccountsEnabled ? "BẬT" : "TẮT"}</strong></p>
      <button className={organizationAccountsEnabled ? "secondary" : "primary"} onClick={() => void toggle("ORG_ACCOUNTS_ENABLED", organizationAccountsEnabled)}>{organizationAccountsEnabled ? "Tắt" : "Bật"}</button>
    </section>
    <section className="panel">
      <h2>Công tắc thanh toán Đoàn phí</h2>
      <p>Trạng thái database: <strong>{paymentEnabled ? "BẬT" : "TẮT"}</strong></p>
      <button className={paymentEnabled ? "secondary" : "primary"} onClick={() => void toggle("PAYMENT_ENABLED", paymentEnabled)}>{paymentEnabled ? "Tắt" : "Bật"}</button>
    </section>
    <section className="panel">
      <h2>Tạo hoặc quản lý tài khoản</h2>
      <form className="form-grid" onSubmit={(event) => void manage(event)}>
        <label>Đơn vị<input name="organizationId" required placeholder="UUID đơn vị" /></label>
        <label>Thao tác<select name="action" defaultValue="create"><option value="create">Tạo</option><option value="reset_pin">Đặt lại PIN</option><option value="lock">Khóa</option><option value="unlock">Mở khóa</option></select></label>
        <label>PIN 6 số<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" /></label>
        <label>Lý do<input name="reason" minLength={3} required /></label>
        <div className="full"><button className="primary">Thực hiện</button></div>
      </form>
    </section>
    <section className="panel"><h2>Danh sách tài khoản tổ chức</h2>
      <div className="table-wrap"><table><thead><tr><th>Đơn vị</th><th>Loại</th><th>Trạng thái</th><th>Mã đơn vị</th></tr></thead><tbody>
        {accounts.map((account) => <tr key={account.userId}><td>{account.organizationName}</td><td>{account.unitType}</td><td>{account.status}</td><td>{account.organizationId}</td></tr>)}
      </tbody></table></div>
    </section>
  </>;
}
