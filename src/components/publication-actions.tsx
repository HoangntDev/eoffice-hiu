"use client";

import { useState, type FormEvent } from "react";
import { postJson, send, useAction } from "@/components/acceptance-actions";
import { sourceLabels, type PublicationSource } from "@/modules/program-publication/schemas";

type Draft = { title: string; body: string };
type Proposal = { id: string; title: string; body: string; label: string };

// Ban Tuyên giáo – Truyền thông biên tập bài: tự viết, sinh từ dữ liệu chương trình, hoặc dùng đề xuất của Khoa.
export function PublicationEditor({ programId, initial, initialSource, generated, proposals, published }: {
  programId: string; initial: Draft; initialSource: PublicationSource | null; generated: Draft;
  proposals: Proposal[]; published: boolean;
}) {
  const { busy, run, notices } = useAction();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [source, setSource] = useState<PublicationSource>(initialSource ?? "manual");
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function load(draft: Draft, nextSource: PublicationSource, id: string | null = null) {
    setTitle(draft.title);
    setBody(draft.body);
    setSource(nextSource);
    setProposalId(id);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => postJson(`/api/event-programs/${programId}/publication`, {
      title, body, source, proposalId: source === "proposal" ? proposalId : null, reason: reason.trim() || null,
    }));
    if (ok) setReason("");
  }
  return (
    <form className="stack" onSubmit={(event) => void save(event)} data-testid="publication-editor">
      <div className="inline">
        <button type="button" className="secondary small" onClick={() => load(generated, "generated")}>
          Sinh bản nháp từ dữ liệu chương trình
        </button>
        {proposals.map((p) => (
          <button key={p.id} type="button" className="secondary small" onClick={() => load(p, "proposal", p.id)}>
            Dùng đề xuất {p.label}
          </button>
        ))}
      </div>
      <p className="muted">Nguồn bản nháp: {sourceLabels[source]}. Không đưa MSSV, danh sách điểm danh, hồ sơ ký hay điểm uy tín vào bài.</p>
      <label>
        Tiêu đề chính thức
        <input name="title" required minLength={10} maxLength={200} value={title}
          onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Nội dung (để trống một dòng giữa các đoạn)
        <textarea name="body" rows={10} required minLength={50} maxLength={20000} value={body}
          onChange={(event) => setBody(event.target.value)} />
      </label>
      {published && (
        <label>
          Lý do sửa (bài đã lên E-Office, tối thiểu 10 ký tự)
          <input name="reason" required minLength={10} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
      )}
      <div><button className="primary" disabled={busy}>Lưu bài</button></div>
      {notices}
    </form>
  );
}

// Khoa (BTC) gửi nội dung đề xuất cho Ban.
export function PublicationProposalForm({ programId }: { programId: string }) {
  const { busy, run, notices } = useAction();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run(() => postJson(`/api/event-programs/${programId}/publication/proposals`, {
      title: String(data.get("title") ?? "").trim(), body: String(data.get("body") ?? "").trim(),
    }));
    if (ok) form.reset();
  }
  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <label>Tiêu đề đề xuất<input name="title" required minLength={10} maxLength={200} /></label>
      <label>Nội dung đề xuất<textarea name="body" rows={6} required minLength={50} maxLength={20000} /></label>
      <div><button className="primary" disabled={busy}>Gửi đề xuất cho Ban Tuyên giáo</button></div>
      {notices}
    </form>
  );
}

export function PublicationCoverUpload({ programId, published }: { programId: string; published: boolean }) {
  const { busy, run, notices } = useAction();
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await run(() => send(`/api/event-programs/${programId}/publication/cover`, { method: "POST", body: new FormData(form) }))) form.reset();
  }
  return (
    <form className="stack" onSubmit={(event) => void upload(event)}>
      <label>Ảnh đại diện (JPG/PNG/WEBP, tối đa 5MB)<input name="file" type="file" required accept="image/jpeg,image/png,image/webp" /></label>
      {published && <label>Lý do đổi ảnh<input name="reason" required minLength={10} maxLength={2000} /></label>}
      <div><button className="secondary" disabled={busy}>Tải ảnh đại diện</button></div>
      {notices}
    </form>
  );
}

// Ban đăng tay trên Facebook rồi nhập đường dẫn và thời gian đăng thực tế (giờ Việt Nam).
export function FacebookPostForm({ programId, initialUrl, initialPostedAt, requireReason }: {
  programId: string; initialUrl: string; initialPostedAt: string; requireReason: boolean;
}) {
  const { busy, run, notices } = useAction();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(() => postJson(`/api/event-programs/${programId}/publication/facebook`, {
      url: String(data.get("url") ?? "").trim(), postedAt: String(data.get("postedAt") ?? ""),
      reason: String(data.get("reason") ?? "").trim() || null,
    }));
  }
  return (
    <form className="stack" onSubmit={(event) => void submit(event)} data-testid="facebook-form">
      <div className="form-grid">
        <label>Đường dẫn bài Facebook<input name="url" type="url" required maxLength={500} placeholder="https://www.facebook.com/…"
          defaultValue={initialUrl} /></label>
        <label>Thời gian đăng thực tế<input name="postedAt" type="datetime-local" required defaultValue={initialPostedAt} /></label>
      </div>
      {requireReason && <label>Lý do sửa<input name="reason" required minLength={10} maxLength={2000} /></label>}
      <div><button className="secondary" disabled={busy}>Lưu bài Facebook</button></div>
      {notices}
    </form>
  );
}
