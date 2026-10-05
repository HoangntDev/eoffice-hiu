"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Question, AudienceRule } from "@/modules/forms/schemas";

interface Template {
  id: string;
  title: string;
  description: string | null;
  audience_rule: AudienceRule;
  status: string;
  questions: Question[];
}

interface Props {
  template?: Template;
}

const defaultAudience: AudienceRule = { type: "hiu_student" };
const questionTypeLabels: Record<string, string> = {
  short_text:    "Văn bản ngắn",
  long_text:     "Văn bản dài",
  number:        "Số",
  date:          "Ngày",
  single_choice: "Một lựa chọn",
  multi_choice:  "Nhiều lựa chọn",
  dropdown:      "Dropdown",
};

function newQuestion(order: number): Question {
  return {
    id: crypto.randomUUID(),
    type: "short_text",
    label: "",
    required: false,
    order,
  };
}

export function FormTemplateEditor({ template }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [status, setStatus] = useState<string>(template?.status ?? "draft");
  const [audienceType, setAudienceType] = useState<string>(
    (template?.audience_rule as AudienceRule & { type: string })?.type ?? "hiu_student"
  );
  const [facultyId, setFacultyId] = useState(
    (template?.audience_rule as { type: string; faculty_id?: string })?.faculty_id ?? ""
  );
  const [questions, setQuestions] = useState<Question[]>(template?.questions ?? []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function buildAudienceRule(): AudienceRule {
    if (audienceType === "faculty") return { type: "faculty", faculty_id: facultyId };
    return { type: audienceType as AudienceRule["type"] } as AudienceRule;
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion(prev.length)]);
  }

  function updateQuestion(index: number, updates: Partial<Question>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })));
  }

  function addOption(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const options = q.options ?? [];
        return { ...q, options: [...options, { id: crypto.randomUUID(), label: "", order: options.length }] };
      })
    );
  }

  function updateOption(qIndex: number, oIndex: number, label: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || !q.options) return q;
        return { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, label } : o)) };
      })
    );
  }

  function removeOption(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || !q.options) return q;
        return { ...q, options: q.options.filter((_, j) => j !== oIndex).map((o, k) => ({ ...o, order: k })) };
      })
    );
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setSaving(true);
    try {
      const body = {
        id: template?.id,
        title,
        description: description || null,
        audience_rule: buildAudienceRule(),
        questions,
        status,
      };
      const res = await fetch(
        template?.id ? `/api/forms/templates/${template.id}` : "/api/forms/templates",
        { method: template?.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      );
      const result = await res.json() as { id?: string; message?: string };
      if (!res.ok) throw new Error((result as { message?: string }).message ?? "Lưu thất bại.");
      setMessage("Đã lưu mẫu.");
      if (!template?.id && result.id) router.push(`/forms/templates/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!template?.id) return;
    if (!confirm("Phát hành phiên bản mới sẽ đóng băng câu hỏi hiện tại. Tiếp tục?")) return;
    setError(""); setMessage(""); setSaving(true);
    try {
      const res = await fetch(`/api/forms/templates/${template.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) {
        const result = await res.json() as { message?: string };
        throw new Error(result.message ?? "Phát hành thất bại.");
      }
      setMessage("Đã phát hành phiên bản mới.");
      setStatus("published");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phát hành thất bại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={(e) => void handleSave(e)}>
      {error && <p className="notice error full" role="alert">{error}</p>}
      {message && <p className="notice full">{message}</p>}

      <label className="full">
        Tiêu đề mẫu
        <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={200} />
      </label>
      <label className="full">
        Mô tả
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
      </label>

      <label>
        Đối tượng áp dụng
        <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)}>
          <option value="hiu_student">Sinh viên HIU</option>
          <option value="union_member">Đoàn viên đã công nhận</option>
          <option value="faculty">Sinh viên một Khoa</option>
          <option value="any">Bất kỳ (kể cả khách ngoài trường)</option>
        </select>
      </label>
      {audienceType === "faculty" && (
        <label>
          UUID Khoa
          <input value={facultyId} onChange={(e) => setFacultyId(e.target.value)} placeholder="UUID của Khoa" required />
        </label>
      )}

      <label>
        Trạng thái mẫu
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">Bản nháp</option>
          <option value="published">Đang phát hành</option>
          <option value="deprecated">Ngừng dùng</option>
        </select>
      </label>

      <section className="panel full">
        <div className="inline" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>Câu hỏi ({questions.length})</h3>
          <button type="button" className="secondary small" onClick={addQuestion}>+ Thêm câu hỏi</button>
        </div>

        {questions.length === 0 && <p className="muted">Chưa có câu hỏi nào. Thêm câu hỏi để người dùng điền.</p>}

        {questions.map((q, qIndex) => (
          <div key={q.id} className="panel" style={{ border: "1px solid var(--border)", marginTop: "0.5rem" }}>
            <div className="form-grid">
              <label>
                Loại câu hỏi
                <select value={q.type} onChange={(e) => updateQuestion(qIndex, { type: e.target.value as Question["type"] })}>
                  {Object.entries(questionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>
                Câu hỏi <span className="muted">(nhãn hiển thị)</span>
                <input value={q.label} onChange={(e) => updateQuestion(qIndex, { label: e.target.value })} required />
              </label>
              <label>
                Mô tả / hướng dẫn điền
                <input value={q.description ?? ""} onChange={(e) => updateQuestion(qIndex, { description: e.target.value || null })} />
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })} />
                Bắt buộc trả lời
              </label>

              {["single_choice", "multi_choice", "dropdown"].includes(q.type) && (
                <div className="full">
                  <p className="muted small">Lựa chọn:</p>
                  {(q.options ?? []).map((opt, oIndex) => (
                    <div key={opt.id} className="inline" style={{ gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <input
                        value={opt.label}
                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                        placeholder={`Lựa chọn ${oIndex + 1}`}
                        required
                      />
                      <button type="button" className="secondary small" onClick={() => removeOption(qIndex, oIndex)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="secondary small" onClick={() => addOption(qIndex)}>+ Thêm lựa chọn</button>
                </div>
              )}

              <div className="full" style={{ textAlign: "right" }}>
                <button type="button" className="secondary small" onClick={() => removeQuestion(qIndex)}>Xóa câu hỏi</button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="inline full">
        <button className="primary" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu mẫu"}
        </button>
        {template?.id && (
          <button type="button" className="secondary" onClick={() => void handlePublish()} disabled={saving}>
            Phát hành phiên bản
          </button>
        )}
      </div>
    </form>
  );
}
