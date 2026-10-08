import { notFound } from "next/navigation";
import Link from "next/link";
import { createUserSupabase } from "@/lib/supabase/server";
import type { Question } from "@/modules/forms/schemas";

interface Answer { question_id: string; answer_value: unknown; }
interface Response {
  id: string;
  submitted_at: string;
  respondent_user_id: string | null;
  respondent_email: string | null;
  answers: Answer[];
}

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserSupabase();

  const { data: form } = await supabase.from("forms").select("id, title, questions, status").eq("id", id).single();
  if (!form) notFound();

  const questions: Question[] = ((form.questions as Question[]) ?? []).sort((a, b) => a.order - b.order);

  const { data: responsesRaw, error } = await supabase
    .from("form_responses")
    .select("id, submitted_at, respondent_user_id, respondent_email")
    .eq("form_id", id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return (
      <main className="page">
        <p className="notice error">Bạn không có quyền xem phản hồi của biểu mẫu này.</p>
      </main>
    );
  }

  const responses = responsesRaw ?? [];
  let answersMap: Record<string, Answer[]> = {};

  if (responses.length > 0) {
    const { data: allAnswers } = await supabase
      .from("form_response_answers")
      .select("response_id, question_id, answer_value")
      .in("response_id", responses.map((r) => r.id));
    answersMap = (allAnswers ?? []).reduce<Record<string, Answer[]>>((acc, a) => {
      if (!acc[a.response_id]) acc[a.response_id] = [];
      acc[a.response_id].push({ question_id: a.question_id, answer_value: a.answer_value });
      return acc;
    }, {});
  }

  const fullResponses: Response[] = responses.map((r) => ({ ...r, answers: answersMap[r.id] ?? [] }));

  // Build option ID→label map for choice questions
  const optionLabels = new Map<string, Map<string, string>>();
  for (const q of questions) {
    if (q.options) {
      const m = new Map<string, string>();
      for (const o of q.options) m.set(o.id, o.label);
      optionLabels.set(q.id, m);
    }
  }

  function getAnswer(response: Response, q: Question): string {
    const a = response.answers.find((x) => x.question_id === q.id);
    if (!a || a.answer_value === null) return "—";
    const opts = optionLabels.get(q.id);
    if (Array.isArray(a.answer_value)) {
      return a.answer_value.map((v) => opts?.get(String(v)) ?? String(v)).join(", ");
    }
    return (opts?.get(String(a.answer_value)) ?? String(a.answer_value));
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Biểu mẫu / Phản hồi</p>
          <h1>{form.title as string}</h1>
          <p className="lead">{fullResponses.length} phản hồi</p>
        </div>
        <div className="inline">
          <Link href={`/forms/${id}/edit`} className="button secondary">Chỉnh sửa</Link>
          <a href={`/api/forms/${id}/export`} className="button primary" download>
            Xuất CSV
          </a>
        </div>
      </div>

      {fullResponses.length === 0 ? (
        <p className="notice">Chưa có phản hồi nào.</p>
      ) : (
        <div className="table-wrap" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người nộp</th>
                {questions.map((q) => <th key={q.id}>{q.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {fullResponses.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(r.submitted_at).toLocaleString("vi-VN")}
                  </td>
                  <td>{r.respondent_email ?? (r.respondent_user_id ? `user:${r.respondent_user_id.slice(0, 8)}` : "Ẩn danh")}</td>
                  {questions.map((q) => (
                    <td key={q.id}>{getAnswer(r, q)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
