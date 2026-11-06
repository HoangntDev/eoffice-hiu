"use client";

// Lỗi chưa xử lý khi hiển thị trang: chỉ cho người dùng thấy câu thân thiện và mã tham chiếu.
// Chi tiết kỹ thuật được ghi ở server (src/instrumentation.ts, sự kiện app.unhandled_error, trường reference).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Đã có lỗi xảy ra</h1>
      <p className="mt-3 text-sm text-slate-600">
        Hệ thống chưa xử lý được yêu cầu. Vui lòng thử lại sau ít phút.
        {error.digest ? <> Nếu lỗi lặp lại, hãy gửi mã tham chiếu <code className="font-mono">{error.digest}</code> cho Văn phòng Đoàn – Hội.</> : null}
      </p>
      <button type="button" onClick={reset} className="mt-6 rounded-md border px-4 py-2 text-sm">
        Thử lại
      </button>
    </main>
  );
}
