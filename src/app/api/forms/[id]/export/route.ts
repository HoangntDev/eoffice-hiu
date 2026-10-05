import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError } from "@/lib/http";
import type { Question } from "@/modules/forms/schemas";

// CSV export: one row per response; columns = stable question labels from the latest snapshot.
// Why questions_snapshot from the first response rather than live form? Because if questions changed,
// each response may have a different schema. We use the form's current questions as the column header,
// then match answers by question_id (stable), so old answers still appear under the right column.

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join("; ") : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();

    // Fetch form (owner check via RLS)
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("title, questions")
      .eq("id", id)
      .single();
    if (formError || !form) throw new HttpError(404, "FORM_NOT_FOUND", "Biểu mẫu không tồn tại.");

    const questions: Question[] = (form.questions as Question[]) ?? [];

    // Fetch responses with answers (RLS restricts to owner org)
    const { data: responses, error: respError } = await supabase
      .from("form_responses")
      .select("id, respondent_user_id, respondent_email, submitted_at, identity_snapshot")
      .eq("form_id", id)
      .order("submitted_at", { ascending: true });
    if (respError) throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền xuất phản hồi.");

    if (!responses || responses.length === 0) {
      return new NextResponse("Không có phản hồi nào.", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const responseIds = responses.map((r) => r.id);
    const { data: allAnswers } = await supabase
      .from("form_response_answers")
      .select("response_id, question_id, answer_value")
      .in("response_id", responseIds);

    const answerMap = new Map<string, Map<string, unknown>>();
    for (const a of allAnswers ?? []) {
      if (!answerMap.has(a.response_id)) answerMap.set(a.response_id, new Map());
      answerMap.get(a.response_id)!.set(a.question_id, a.answer_value);
    }

    // Build CSV — sorted by question order
    const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
    const headers = [
      "Thời gian nộp",
      "Email người nộp",
      ...sortedQuestions.map((q) => q.label),
    ];

    const rows = responses.map((r) => {
      const answers = answerMap.get(r.id) ?? new Map();
      return [
        r.submitted_at,
        r.respondent_email ?? "",
        ...sortedQuestions.map((q) => answers.get(q.id) ?? ""),
      ].map(escapeCsv).join(",");
    });

    const bom = "﻿"; // UTF-8 BOM so Excel opens correctly
    const csv = bom + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const filename = `phan-hoi-${id.slice(0, 8)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
