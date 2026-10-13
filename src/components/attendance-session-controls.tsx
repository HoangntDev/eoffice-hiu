"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionStatus } from "@/modules/program-attendance/schemas";

type Props = { programId: string; sessionId: string; label: string; status: SessionStatus };

// Mở/đóng một lượt; mở lại lượt đã đóng (điểm danh bổ sung) bắt buộc ghi lý do.
export function AttendanceSessionControls({ programId, sessionId, label, status }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(next: "open" | "closed") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/attendance/sessions/${sessionId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, reason: reason.trim() || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Thao tác thất bại.");
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
      <div className="inline">
        {status === "draft" && <button className="primary small" disabled={busy} onClick={() => void setStatus("open")}>Mở lượt</button>}
        {status === "open" && (
          <>
            <Link className="button primary small" href={`/programs/${programId}/attendance/${sessionId}/qr`}>Hiển thị QR</Link>
            <button className="secondary small" disabled={busy} onClick={() => void setStatus("closed")}>Đóng lượt</button>
          </>
        )}
        {status === "closed" && (
          <>
            <input aria-label={`Lý do mở lại ${label}`} placeholder="Lý do điểm danh bổ sung" value={reason}
              maxLength={2000} onChange={(event) => setReason(event.target.value)} />
            <button className="secondary small" disabled={busy} onClick={() => void setStatus("open")}>Mở lại lượt</button>
          </>
        )}
      </div>
      {error && <p className="notice error">{error}</p>}
    </div>
  );
}
