"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UNION_FEE_MONTHLY_AMOUNTS } from "@/modules/payments/fee";

export function UnionFeeCampaignForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          calendarYear: Number(formData.get("calendarYear")),
          monthlyAmount: Number(formData.get("monthlyAmount")),
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Không thể tạo khoản thu.");
      router.refresh();
      setMessage("Đã tạo khoản Đoàn phí cho năm đã chọn.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo khoản thu.");
    } finally {
      setPending(false);
    }
  }

  return <form action={(formData) => void submit(formData)} className="form-grid">
    <label>Năm dương lịch
      <input name="calendarYear" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required />
    </label>
    <label>Mức thu mỗi tháng
      <select name="monthlyAmount" defaultValue="5000" required>
        {UNION_FEE_MONTHLY_AMOUNTS.map((amount) => <option key={amount} value={amount}>{amount.toLocaleString("vi-VN")} đồng</option>)}
      </select>
    </label>
    <div className="full inline">
      <button className="button primary" disabled={pending}>{pending ? "Đang tạo…" : "Tạo khoản thu 12 tháng"}</button>
      {message && <span className="muted" role="status">{message}</span>}
    </div>
  </form>;
}
