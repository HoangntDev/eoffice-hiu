"use client";

import { useEffect, useState } from "react";

// Lỗi chưa xử lý khi hiển thị trang: chỉ cho người dùng thấy câu thân thiện và mã tham chiếu.
// Chi tiết kỹ thuật được ghi ở server (src/instrumentation.ts, sự kiện app.unhandled_error).
// Mã tham chiếu = digest của lỗi phía server (trường reference trong log); nếu lỗi xảy ra khi
// render lại ở trình duyệt thì không có digest, dùng 8 ký tự đầu của requestId (trường requestId).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [requestId, setRequestId] = useState<string | null>(null);
  useEffect(() => {
    setRequestId(document.querySelector('meta[name="x-request-id"]')?.getAttribute("content") ?? null);
  }, []);
  const reference = error.digest ?? requestId?.slice(0, 8);

  return (
    <main className="page" style={{ textAlign: "center" }}>
      <h1>Đã có lỗi xảy ra</h1>
      <p className="lead">Hệ thống chưa xử lý được yêu cầu. Vui lòng thử lại sau ít phút.</p>
      {reference ? (
        <p>
          Nếu lỗi lặp lại, hãy gửi mã tham chiếu <code>{reference}</code> cho Văn phòng Đoàn – Hội.
        </p>
      ) : null}
      <button type="button" className="button" onClick={reset}>
        Thử lại
      </button>
    </main>
  );
}
