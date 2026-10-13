"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { programId: string; registrationId: string; studentLabel: string };

// Nút duyệt/từ chối một đăng ký. Lý do bắt buộc khi từ chối, và khi duyệt vượt người uy tín cao hơn
// (server trả SKIP_REASON_REQUIRED; ô lý do dùng chung cho cả hai trường hợp).
export function RegistrationDecision({ programId, registrationId, studentLabel }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/event-programs/${programId}/registrations/${registrationId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) {
        const firstField = result.fields ? Object.values(result.fields as Record<string, string[]>)[0]?.[0] : undefined;
        throw new Error(firstField ?? result.message ?? "Thao tác thất bại.");
      }
      setReason("");
      router.refresh();
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <input
        aria-label={`Lý do cho ${studentLabel}`}
        placeholder="Lý do (bắt buộc khi từ chối hoặc duyệt ngoại lệ)"
        value={reason}
        maxLength={2000}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="inline">
        <button className="primary small" disabled={busy} onClick={() => void decide("approve")}>Duyệt</button>
        <button className="secondary small" disabled={busy} onClick={() => void decide("reject")}>Từ chối</button>
      </div>
      {error && <p className="notice error">{error}</p>}
    </div>
  );
}
