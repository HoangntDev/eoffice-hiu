"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Question, AudienceRule } from "@/modules/forms/schemas";

interface OrgUnit { id: string; name: string; unit_type: string; }
interface TemplateOption { id: string; title: string; }

interface Form {
  id: string;
  owner_org_id: string;
  title: string;
  description: string | null;
  audience_rule: AudienceRule;
  questions: Question[];
  allow_multiple_submissions: boolean;
  opens_at: string | null;
  closes_at: string | null;
  confirmation_message: string | null;
  status: string;
}

interface Props {
  form?: Form;
  orgs: OrgUnit[];
  templates: TemplateOption[];
}

const questionTypeLabels: Record<string, string> = {
  short_text: "Văn bản ngắn", long_text: "Văn bản dài", number: "Số",
  date: "Ngày", single_choice: "Một lựa chọn", multi_choice: "Nhiều lựa chọn", dropdown: "Dropdown",
};

function newQuestion(order: number): Question {
  return { id: crypto.randomUUID(), type: "short_text", label: "", required: false, order };
}

export function FormEditor({ form, orgs, templates }: Props) {
  const router = useRouter();
  const [ownerOrgId, setOwnerOrgId] = useState(form?.owner_org_id ?? orgs[0]?.id ?? "");
  const [title, setTitle] = useState(form?.title ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [audienceType, setAudienceType] = useState<string>(
    (form?.audience_rule as AudienceRule & { type: string })?.type ?? "hiu_student"
  );
  const [questions, setQuestions] = useState<Question[]>(form?.questions ?? []);
  const [allowMultiple, setAllowMultiple] = useState(form?.allow_multiple_submissions ?? false);
  const [opensAt, setOpensAt] = useState(form?.opens_at?.slice(0, 16) ?? "");
  const [closesAt, setClosesAt] = useState(form?.closes_at?.slice(0, 16) ?? "");
  const [confirmMsg, setConfirmMsg] = useState(form?.confirmation_message ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState("");

  async function loadTemplate(tvId: string) {
    if (!tvId) return;
    const res = await fetch(`/api/forms/templates/${tvId}`);
    if (!res.ok) return;
    const result = await res.json() as { template: { title: string; description: string | null; audience_rule: AudienceRule; questions?: Question[] }; versions: Array<{ questions: Question[]; id: string }> };
    const latest = result.versions?.[0];
    if (!title) setTitle(result.template.title);
    if (!description) setDescription(result.template.description ?? "");
    setAudienceType((result.template.audience_rule as { type: string }).type);
    if (latest?.questions) setQuestions(latest.questions.map((q) => ({ ...q, base_question: true })));
    setTemplateId(latest?.id ?? "");
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion(prev.length)]);
  }
  function updateQuestion(index: number, updates: Partial<Question>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  }
  function removeQuestion(index: number) {
    if (questions[index]?.base_question) { setError("Không thể xóa câu hỏi nền từ mẫu."); return; }
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })));
  }
  function addOption(qIndex: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const options = q.options ?? [];
      return { ...q, options: [...options, { id: crypto.randomUUID(), label: "", order: options.length }] };
    }));
  }
  function updateOption(qIndex: number, oIndex: number, label: string) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex || !q.options) return q;
      return { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, label } : o)) };
    }));
  }
  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIndex || !q.options) return q;
      return { ...q, options: q.options.filter((_, j) => j !== oIndex).map((o, k) => ({ ...o, order: k })) };
    }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setSaving(true);
    try {
      const body = {
        id: form?.id,
        owner_org_id: ownerOrgId,
        title,
        description: description || null,
        audience_rule: { type: audienceType },
        questions,
        allow_multiple_submissions: allowMultiple,
        opens_at: opensAt ? new Date(opensAt).toISOString() : null,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        confirmation_message: confirmMsg || null,
        template_version_id: templateId || null,
      };
      const res = await fetch(
        form?.id ? `/api/forms/${form.id}` : "/api/forms",
        { method: form?.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      );
      const result = await res.json() as { id?: string; message?: string };
      if (!res.ok) throw new Error((result as { message?: string }).message ?? "Lưu thất bại.");
      setMessage("Đã lưu biểu mẫu.");
      if (!form?.id && result.id) router.push(`/forms/${result.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally { setSaving(false); }
  }

  async function handleStatusChange(status: string) {
    if (!form?.id) return;
    setError(""); setMessage(""); setSaving(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/status`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const r = await res.json() as { message?: string }; throw new Error(r.message ?? "Thất bại."); }
      setMessage(`Đã chuyển sang: ${status}`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Thất bại."); }
    finally { setSaving(false); }
  }

  return (
    <form className="form-grid" onSubmit={(e) => void handleSave(e)}>
      {error && <p className="notice error full" role="alert">{error}</p>}
      {message && <p className="notice full">{message}</p>}

      {!form?.id && templates.length > 0 && (
        <label>
          Tạo từ mẫu (tùy chọn)
          <select onChange={(e) => void loadTemplate(e.target.value)}>
            <option value="">Biểu mẫu độc lập</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
      )}

      <label>
        Đơn vị sở hữu
        <select value={ownerOrgId} onChange={(e) => setOwnerOrgId(e.target.value)} required>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>

      <label className="full">
        Tiêu đề biểu mẫu
        <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200} />
      </label>
      <label className="full">
        Mô tả
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
      </label>

      <label>
        Đối tượng
        <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)}>
          <option value="hiu_student">Sinh viên HIU</option>
          <option value="union_member">Đoàn viên đã công nhận</option>
          <option value="any">Bất kỳ (kể cả khách ngoài)</option>
        </select>
      </label>

      <label>
        Thời gian mở
        <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
      </label>
      <label>
        Thời gian đóng
        <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
      </label>

      <label>
        <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />
        Cho phép nộp nhiều lần
      </label>

      <label className="full">
        Thông báo sau khi nộp
        <input value={confirmMsg} onChange={(e) => setConfirmMsg(e.target.value)} maxLength={500} placeholder="Cảm ơn bạn đã điền biểu mẫu!" />
      </label>

      <section className="panel full">
        <div className="inline" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>Câu hỏi ({questions.length})</h3>
          <button type="button" className="secondary small" onClick={addQuestion}>+ Thêm câu hỏi</button>
        </div>

        {questions.length === 0 && <p className="muted">Chưa có câu hỏi. Thêm câu hỏi hoặc tải từ mẫu.</p>}

        {questions.map((q, qIndex) => (
          <div key={q.id} className="panel" style={{ border: `1px solid ${q.base_question ? "var(--primary)" : "var(--border)"}`, marginTop: "0.5rem" }}>
            {q.base_question && <p className="muted small" style={{ marginBottom: "0.5rem" }}>Câu hỏi nền từ mẫu (không thể xóa)</p>}
            <div className="form-grid">
              <label>
                Loại
                <select value={q.type} onChange={(e) => updateQuestion(qIndex, { type: e.target.value as Question["type"] })} disabled={!!q.base_question}>
                  {Object.entries(questionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>
                Câu hỏi
                <input value={q.label} onChange={(e) => updateQuestion(qIndex, { label: e.target.value })} required />
              </label>
              <label>
                Mô tả
                <input value={q.description ?? ""} onChange={(e) => updateQuestion(qIndex, { description: e.target.value || null })} />
              </label>
              <label>
                <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })} />
                Bắt buộc
              </label>

              {["single_choice", "multi_choice", "dropdown"].includes(q.type) && (
                <div className="full">
                  {(q.options ?? []).map((opt, oIndex) => (
                    <div key={opt.id} className="inline" style={{ gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <input value={opt.label} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} placeholder={`Lựa chọn ${oIndex + 1}`} required />
                      <button type="button" className="secondary small" onClick={() => removeOption(qIndex, oIndex)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="secondary small" onClick={() => addOption(qIndex)}>+ Thêm lựa chọn</button>
                </div>
              )}

              {!q.base_question && (
                <div className="full" style={{ textAlign: "right" }}>
                  <button type="button" className="secondary small" onClick={() => removeQuestion(qIndex)}>Xóa</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="inline full">
        <button className="primary" disabled={saving}>{saving ? "Đang lưu…" : "Lưu biểu mẫu"}</button>
        {form?.id && form.status === "draft" && (
          <button type="button" className="secondary" onClick={() => void handleStatusChange("published")} disabled={saving}>
            Phát hành
          </button>
        )}
        {form?.id && form.status === "published" && (
          <button type="button" className="secondary" onClick={() => void handleStatusChange("paused")} disabled={saving}>
            Tạm dừng
          </button>
        )}
        {form?.id && form.status === "published" && (
          <button type="button" className="secondary" onClick={() => void handleStatusChange("closed")} disabled={saving}>
            Đóng nhận phản hồi
          </button>
        )}
      </div>
    </form>
  );
}
