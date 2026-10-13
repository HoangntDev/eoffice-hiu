"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type State = { kind: "pending" } | { kind: "ok"; message: string } | { kind: "error"; code: string; message: string };

async function submitCheckIn(sessionId: string, token: string): Promise<State> {
  try {
    const response = await fetch("/api/attendance/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, token }),
    });
    const result = await response.json();
    if (response.ok) return { kind: "ok", message: result.message };
    return { kind: "error", code: result.error ?? "ERROR", message: result.message ?? "Điểm danh thất bại." };
  } catch {
    return { kind: "error", code: "NETWORK", message: "Mất kết nối. Vui lòng quét lại mã QR." };
  }
}

// Sinh viên mở liên kết từ QR: gửi điểm danh một lần khi trang tải (POST, không dùng GET để tránh prefetch).
export function AttendanceCheckIn({ sessionId, token, programId }: { sessionId: string; token: string; programId: string | null }) {
  const [state, setState] = useState<State>({ kind: "pending" });

  // Một lần gửi cho mỗi mã, kể cả khi StrictMode (dev) chạy effect hai lần.
  const request = useRef<Promise<State> | null>(null);

  useEffect(() => {
    let cancelled = false;
    request.current ??= submitCheckIn(sessionId, token);
    void request.current.then((result) => { if (!cancelled) setState(result); });
    return () => { cancelled = true; };
  }, [sessionId, token]);

  if (state.kind === "pending") return <p className="muted" role="status">Đang ghi nhận điểm danh…</p>;
  return (
    <div className="stack">
      {state.kind === "ok"
        ? <p className="notice" role="status" data-testid="check-in-result">{state.message}</p>
        : <p className="notice error" role="alert" data-testid="check-in-result">{state.message}</p>}
      {state.kind === "error" && ["QR_EXPIRED", "QR_INVALID", "WRONG_SESSION"].includes(state.code) && (
        <p className="muted">Hãy quét lại mã QR đang hiển thị tại chương trình.</p>
      )}
      {programId && <Link href={`/programs/${programId}`}>Xem chương trình</Link>}
    </div>
  );
}
