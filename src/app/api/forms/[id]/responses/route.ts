import { NextResponse } from "next/server";
import { requireUser, requireSessionUser } from "@/lib/auth/dal";
import { createPublicSupabase } from "@/lib/supabase/server";
import { apiError, HttpError, readJson } from "@/lib/http";
import { submitResponseSchema } from "@/modules/forms/schemas";

const errorMessages: Record<string, [number, string]> = {
  FORM_NOT_FOUND:    [404, "Biểu mẫu không tồn tại."],
  FORM_NOT_PUBLISHED:[422, "Biểu mẫu chưa được phát hành."],
  FORM_NOT_YET_OPEN: [422, "Biểu mẫu chưa mở nhận phản hồi."],
  FORM_CLOSED:       [422, "Biểu mẫu đã hết thời gian nhận phản hồi."],
  AUDIENCE_NOT_MET:  [403, "Bạn không thuộc đối tượng biểu mẫu này."],
  ALREADY_SUBMITTED: [409, "Bạn đã nộp phản hồi cho biểu mẫu này."],
  REQUIRED_QUESTION_MISSING: [422, "Vui lòng trả lời đầy đủ các câu hỏi bắt buộc."],
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data: responses, error } = await supabase
      .from("form_responses")
      .select("id, form_version, respondent_user_id, respondent_email, submitted_at, identity_snapshot")
      .eq("form_id", id)
      .order("submitted_at", { ascending: false });
    if (error) throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền xem phản hồi của biểu mẫu này.");

    if (!responses || responses.length === 0) {
      return NextResponse.json({ responses: [] });
    }

    const responseIds = responses.map((r) => r.id);
    const { data: answers } = await supabase
      .from("form_response_answers")
      .select("response_id, question_id, answer_value")
      .in("response_id", responseIds);

    const answersByResponse = (answers ?? []).reduce<Record<string, Array<{ question_id: string; answer_value: unknown }>>>(
      (acc, a) => {
        if (!acc[a.response_id]) acc[a.response_id] = [];
        acc[a.response_id].push({ question_id: a.question_id, answer_value: a.answer_value });
        return acc;
      },
      {}
    );

    return NextResponse.json({
      responses: responses.map((r) => ({ ...r, answers: answersByResponse[r.id] ?? [] })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = submitResponseSchema.parse(await readJson(request));

    // Try to get session (optional for guest forms)
    let supabase;
    try {
      const session = await requireSessionUser();
      supabase = session.supabase;
    } catch {
      // Not authenticated — use public client; RPC will deny if audience requires auth
      supabase = createPublicSupabase();
    }

    const { data, error } = await supabase.rpc("submit_form_response", {
      p_form_id:           id,
      p_respondent_email:  input.respondent_email ?? null,
      p_answers:           input.answers,
      p_identity_snapshot: input.identity_snapshot ?? null,
    });

    if (error) {
      const matched = Object.entries(errorMessages).find(([k]) => error.message.includes(k));
      if (matched) throw new HttpError(matched[1][0], matched[0], matched[1][1]);
      throw new HttpError(422, "SUBMIT_FAILED", error.message);
    }
    return NextResponse.json({ response_id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
