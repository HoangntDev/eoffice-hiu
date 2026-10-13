"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { documentKindLabels, documentKinds, type DocumentKind } from "@/modules/program-acceptance/schemas";

async function send(url: string, init: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const firstField = result.fields ? Object.values(result.fields as Record<string, string[]>)[0]?.[0] : undefined;
    throw new Error(firstField ?? result.message ?? "Thao tác thất bại.");
  }
  return result.message ?? "Đã lưu.";
}

const postJson = (url: string, body: unknown) =>
  send(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage(await action());
      router.refresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const notices = (
    <>
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
    </>
  );
  return { busy, run, notices };
}

// Một nút gửi JSON (không cần lý do), ví dụ khóa điểm danh, nộp hồ sơ, nghiệm thu.
export function ActionButton({ url, body = {}, label, className = "primary" }: {
  url: string; body?: Record<string, unknown>; label: string; className?: string;
}) {
  const { busy, run, notices } = useAction();
  return (
    <div className="stack">
      <div><button className={className} disabled={busy} onClick={() => void run(() => postJson(url, body))}>{label}</button></div>
      {notices}
    </div>
  );
}

type Choice = { value: string | null; label: string; className?: string };

// Ô lý do + một hoặc nhiều nút quyết định. Mỗi nút gửi {decision, reason, ...body}; decision null thì không gửi.
export function ReasonAction({ url, body = {}, choices, reasonLabel, placeholder }: {
  url: string; body?: Record<string, unknown>; choices: Choice[]; reasonLabel: string; placeholder?: string;
}) {
  const { busy, run, notices } = useAction();
  const [reason, setReason] = useState("");
  async function decide(choice: Choice) {
    const payload = { ...body, ...(choice.value ? { decision: choice.value } : {}), reason: reason.trim() || null };
    if (await run(() => postJson(url, payload))) setReason("");
  }
  return (
    <div className="stack">
      <label>
        {reasonLabel}
        <textarea rows={2} maxLength={2000} value={reason} placeholder={placeholder} onChange={(event) => setReason(event.target.value)} />
      </label>
      <div className="inline">
        {choices.map((choice) => (
          <button key={choice.label} type="button" className={choice.className ?? "secondary"} disabled={busy}
            onClick={() => void decide(choice)}>{choice.label}</button>
        ))}
      </div>
      {notices}
    </div>
  );
}

// BTC tải Đơn đề nghị / báo cáo / minh chứng. Mỗi lần tải là một phiên bản mới.
export function AcceptanceUpload({ programId }: { programId: string }) {
  const { busy, run, notices } = useAction();
  const [kind, setKind] = useState<DocumentKind>("proposal");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("kind", kind);
    if (await run(() => send(`/api/event-programs/${programId}/acceptance/documents`, { method: "POST", body: data }))) form.reset();
  }
  return (
    <form className="stack" onSubmit={(event) => void upload(event)}>
      <div className="form-grid">
        <label>
          Loại tệp
          <select value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)}>
            {documentKinds.map((k) => <option key={k} value={k}>{documentKindLabels[k]}</option>)}
          </select>
        </label>
        <label>
          Tệp (tối đa 5MB)
          <input name="file" type="file" required
            accept={kind === "evidence" ? "application/pdf,image/jpeg,image/png,image/webp" : "application/pdf"} />
        </label>
      </div>
      <div><button className="primary" disabled={busy}>Tải lên</button></div>
      {notices}
    </form>
  );
}

// Sinh viên khiếu nại thiếu điểm danh một lượt.
export function ComplaintForm({ programId, sessions }: { programId: string; sessions: Array<{ id: string; label: string }> }) {
  const { busy, run, notices } = useAction();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(() => postJson(`/api/event-programs/${programId}/complaints`, {
      sessionId: String(data.get("sessionId")), message: String(data.get("message") ?? "").trim(),
    }));
    if (ok) form.reset();
  }
  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <label>
        Lượt bị thiếu điểm danh
        <select name="sessionId" required>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>
        Nội dung khiếu nại (tối thiểu 10 ký tự)
        <textarea name="message" rows={3} required minLength={10} maxLength={2000} />
      </label>
      <div><button className="primary" disabled={busy}>Gửi khiếu nại</button></div>
      {notices}
    </form>
  );
}

export type AcademicTermValues = {
  id: string; academic_year: string; term_code: string; name: string; starts_on: string; ends_on: string;
};

// Tạo/sửa học kỳ theo khoảng ngày (Đoàn Trường / Văn phòng).
export function AcademicTermForm({ initial }: { initial?: AcademicTermValues }) {
  const { busy, run, notices } = useAction();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(() => postJson("/api/academic-terms", {
      id: initial?.id ?? null,
      academicYear: String(data.get("academicYear")), termCode: String(data.get("termCode")), name: String(data.get("name")),
      startsOn: String(data.get("startsOn")), endsOn: String(data.get("endsOn")),
    }));
    if (ok && !initial) form.reset();
  }
  return (
    <form className="stack" onSubmit={(event) => void save(event)}>
      <div className="form-grid">
        <label>Năm học<input name="academicYear" required placeholder="2026-2027" pattern="\d{4}-\d{4}" defaultValue={initial?.academic_year} /></label>
        <label>Mã học kỳ<input name="termCode" required maxLength={20} placeholder="HK1" defaultValue={initial?.term_code} /></label>
        <label>Tên<input name="name" required minLength={2} maxLength={100} placeholder="Học kỳ 1" defaultValue={initial?.name} /></label>
        <label>Ngày bắt đầu<input name="startsOn" type="date" required defaultValue={initial?.starts_on} /></label>
        <label>Ngày kết thúc<input name="endsOn" type="date" required defaultValue={initial?.ends_on} /></label>
      </div>
      <div><button className={initial ? "secondary small" : "primary"} disabled={busy}>{initial ? "Lưu thay đổi" : "Thêm học kỳ"}</button></div>
      {notices}
    </form>
  );
}
