"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import type { Question } from "@/modules/forms/schemas";

interface FormData {
  id: string;
  title: string;
  description: string | null;
  confirmation_message: string | null;
  questions: Question[];
  closes_at: string | null;
}

interface Props {
  form: FormData;
  prefill?: Record<string, string>;
  isAuthenticated: boolean;
}

export function FormViewer({ form, prefill = {}, isAuthenticated }: Props) {
  const sortedQuestions = [...form.questions].sort((a, b) => a.order - b.order);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const q of sortedQuestions) {
      if (q.prefill_from) {
        const key = q.prefill_from.replace("profile.", "");
        if (prefill[key]) initial[q.id] = prefill[key];
      }
    }
    return initial;
  });
  const [guestEmail, setGuestEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMultiChoice(questionId: string, optionId: string) {
    const current = (answers[questionId] as string[]) ?? [];
    if (current.includes(optionId)) {
      setAnswer(questionId, current.filter((id) => id !== optionId));
    } else {
      setAnswer(questionId, [...current, optionId]);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(""); setSubmitting(true);
    try {
      const answerPayload = sortedQuestions.map((q) => ({
        question_id: q.id,
        answer_value: answers[q.id] ?? null,
      }));

      const body = {
        respondent_email: isAuthenticated ? null : (guestEmail || null),
        answers: answerPayload,
        identity_snapshot: isAuthenticated ? prefill : null,
      };

      const res = await fetch(`/api/forms/${form.id}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const result = await res.json() as { message?: string };
        throw new Error(result.message ?? "Nộp phản hồi thất bại.");
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nộp phản hồi thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
        <h2>Đã nộp thành công!</h2>
        <p>{form.confirmation_message ?? "Cảm ơn bạn đã điền biểu mẫu."}</p>
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
      {error && <p className="notice error full" role="alert">{error}</p>}

      {form.closes_at && (
        <p className="notice full muted">
          Đóng nhận phản hồi: {new Date(form.closes_at).toLocaleString("vi-VN")}
        </p>
      )}

      {!isAuthenticated && (
        <label className="full">
          Email của bạn <span className="muted">(tùy chọn, để nhận xác nhận)</span>
          <input
            type="email"
            value={guestEmail}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGuestEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </label>
      )}

      {sortedQuestions.map((q) => (
        <div key={q.id} className="full">
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            <strong>{q.label}</strong>
            {q.required && <span style={{ color: "var(--error, red)", marginLeft: "0.25rem" }}>*</span>}
          </label>
          {q.description && <p className="muted small" style={{ marginBottom: "0.5rem" }}>{q.description}</p>}

          {q.type === "short_text" && (
            <input
              value={(answers[q.id] as string) ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAnswer(q.id, e.target.value)}
              required={q.required}
              maxLength={q.validation?.maxLength ?? 500}
            />
          )}
          {q.type === "long_text" && (
            <textarea
              value={(answers[q.id] as string) ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAnswer(q.id, e.target.value)}
              required={q.required}
              rows={4}
              maxLength={q.validation?.maxLength ?? 2000}
            />
          )}
          {q.type === "number" && (
            <input
              type="number"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAnswer(q.id, e.target.value ? Number(e.target.value) : null)}
              required={q.required}
              min={q.validation?.min}
              max={q.validation?.max}
            />
          )}
          {q.type === "date" && (
            <input
              type="date"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAnswer(q.id, e.target.value)}
              required={q.required}
            />
          )}
          {q.type === "single_choice" && (
            <div>
              {(q.options ?? []).map((opt) => (
                <label key={opt.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                  <input
                    type="radio"
                    name={q.id}
                    value={opt.id}
                    checked={answers[q.id] === opt.id}
                    onChange={() => setAnswer(q.id, opt.id)}
                    required={q.required && !answers[q.id]}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {q.type === "multi_choice" && (
            <div>
              {(q.options ?? []).map((opt) => (
                <label key={opt.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                  <input
                    type="checkbox"
                    checked={((answers[q.id] as string[]) ?? []).includes(opt.id)}
                    onChange={() => toggleMultiChoice(q.id, opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {q.type === "dropdown" && (
            <select
              value={(answers[q.id] as string) ?? ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setAnswer(q.id, e.target.value)}
              required={q.required}
            >
              <option value="">— Chọn —</option>
              {(q.options ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      ))}

      <div className="inline full">
        <button className="primary" disabled={submitting}>
          {submitting ? "Đang nộp…" : "Nộp phản hồi"}
        </button>
      </div>
    </form>
  );
}
