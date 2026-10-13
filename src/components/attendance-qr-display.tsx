"use client";

import { useEffect, useState } from "react";

type Qr = { url: string; svg: string; issuedAt: string; expiresAt: string; ttlSeconds: number; serverNow: string };

// Màn hình chiếu QR của lượt: lấy mã mới từ server mỗi 30 giây; đếm ngược theo giờ server.
export function AttendanceQrDisplay({ sessionId }: { sessionId: string }) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let tickTimer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const response = await fetch(`/api/attendance/sessions/${sessionId}/qr`, { method: "POST", cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setQr(null);
          setError(result.message ?? "Không lấy được mã QR.");
          return;
        }
        const next = result as Qr;
        // Bù lệch đồng hồ máy chiếu so với server để đổi mã đúng lúc mã cũ hết hạn.
        const skew = Date.now() - new Date(next.serverNow).getTime();
        const expiresLocal = new Date(next.expiresAt).getTime() + skew;
        setError("");
        setQr(next);
        clearInterval(tickTimer);
        const tick = () => setRemaining(Math.max(0, Math.ceil((expiresLocal - Date.now()) / 1000)));
        tick();
        tickTimer = setInterval(tick, 250);
        refreshTimer = setTimeout(() => void load(), Math.max(1000, expiresLocal - Date.now()));
      } catch {
        if (!cancelled) {
          setError("Mất kết nối. Đang thử lại…");
          refreshTimer = setTimeout(() => void load(), 3000);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
      clearInterval(tickTimer);
    };
  }, [sessionId]);

  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!qr) return <p className="muted">Đang tạo mã QR…</p>;
  return (
    <div className="stack" style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG sinh tại server, đổi mỗi 30 giây */}
      <img
        data-testid="attendance-qr"
        src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`}
        alt="Mã QR điểm danh của lượt"
        style={{ display: "block", margin: "0 auto", width: "min(80vw, 420px)", height: "auto", background: "#fff", padding: "12px", borderRadius: "8px" }}
      />
      <p className="lead" aria-live="polite" style={{ margin: "0 auto" }}>Mã đổi sau <strong data-testid="qr-remaining">{remaining}</strong> giây</p>
      <p className="muted">Sinh viên đăng nhập trên điện thoại và quét mã. Mỗi mã chỉ có hiệu lực 30 giây.</p>
    </div>
  );
}
