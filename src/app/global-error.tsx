"use client";

// Lỗi ở layout gốc: thay cả trang, nên phải tự có <html> và <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "64px auto", padding: "0 16px", textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>Đã có lỗi xảy ra</h1>
        <p style={{ fontSize: 14 }}>
          Hệ thống chưa xử lý được yêu cầu. Vui lòng thử lại sau ít phút.
          {error.digest ? <> Mã tham chiếu: <code>{error.digest}</code>.</> : null}
        </p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>
          Thử lại
        </button>
      </body>
    </html>
  );
}
