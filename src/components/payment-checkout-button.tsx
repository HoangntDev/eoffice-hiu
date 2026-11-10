"use client";

import { useState } from "react";

export function PaymentCheckoutButton({ campaignId }: { campaignId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function checkout() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const result = await response.json() as { paymentUrl?: string; message?: string };
      if (!response.ok || !result.paymentUrl) throw new Error(result.message ?? "Không thể mở cổng thanh toán.");
      window.location.assign(result.paymentUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cổng thanh toán đang bận. Vui lòng thử lại.");
      setPending(false);
    }
  }

  return <div>
    <button className="button primary" type="button" disabled={pending} onClick={() => void checkout()}>
      {pending ? "Đang chuyển sang VNPay…" : "Thanh toán qua VNPay"}
    </button>
    {message && <p className="notice error" role="alert">{message}</p>}
  </div>;
}
