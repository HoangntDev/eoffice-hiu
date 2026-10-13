"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = {
  programId: string;
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
  hasDocument: boolean;
};

export function EventProgramActions({ programId, canEdit, canSubmit, canReview, hasDocument }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, init);
      const result = await response.json();
      if (!response.ok) {
        const firstField = result.fields ? Object.values(result.fields as Record<string, string[]>)[0]?.[0] : undefined;
        throw new Error(firstField ?? result.message ?? "Thao tác thất bại.");
      }
      setMessage(result.message ?? "Đã ghi nhận.");
      router.refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await call(`/api/event-programs/${programId}/documents`, { method: "POST", body: new FormData(form) });
    if (ok) form.reset();
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    await call(`/api/event-programs/${programId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: raw.decision, reason: raw.reason || null }),
    });
  }

  if (!canEdit && !canSubmit && !canReview) return null;

  return (
    <section className="panel stack" aria-label="Thao tác với kế hoạch">
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}

      {canEdit && (
        <form className="stack" onSubmit={(event) => void upload(event)}>
          <h2>Bản kế hoạch PDF đã ký</h2>
          <label>
            Chọn tệp PDF (tối đa 5MB)
            <input name="file" type="file" accept="application/pdf,.pdf" required />
          </label>
          <div>
            <button className="secondary" disabled={busy}>{hasDocument ? "Tải bản mới thay thế" : "Tải lên PDF"}</button>
          </div>
        </form>
      )}

      {canSubmit && (
        <div className="stack">
          <h2>Gửi Văn phòng Đoàn – Hội</h2>
          {!hasDocument && <p className="notice warning">Cần tải lên PDF kế hoạch đã ký trước khi gửi.</p>}
          <div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void call(`/api/event-programs/${programId}/submit`, { method: "POST" })}
            >
              Gửi kế hoạch
            </button>
          </div>
        </div>
      )}

      {canReview && (
        <form className="form-grid" onSubmit={(event) => void review(event)}>
          <h2 className="full">Xét duyệt của Văn phòng</h2>
          <label className="full">
            Quyết định
            <select name="decision" required defaultValue="approve">
              <option value="approve">Chấp thuận</option>
              <option value="request_changes">Yêu cầu chỉnh sửa</option>
              <option value="reject">Từ chối</option>
            </select>
          </label>
          <label className="full">
            Lý do / nội dung cần chỉnh sửa (bắt buộc khi yêu cầu chỉnh sửa hoặc từ chối)
            <textarea name="reason" rows={3} maxLength={2000} />
          </label>
          <div className="full">
            <button className="primary" disabled={busy}>Ghi nhận quyết định</button>
          </div>
        </form>
      )}
    </section>
  );
}
