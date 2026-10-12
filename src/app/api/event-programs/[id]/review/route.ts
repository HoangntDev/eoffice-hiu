import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { eventProgramRpcError } from "@/modules/event-programs/errors";
import { reviewEventProgramSchema } from "@/modules/event-programs/schemas";

const resultMessages: Record<string, string> = {
  approved: "Đã chấp thuận kế hoạch.",
  needs_changes: "Đã gửi yêu cầu chỉnh sửa cho Đoàn Khoa.",
  rejected: "Đã từ chối kế hoạch.",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = reviewEventProgramSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("review_event_program", {
      p_program_id: id,
      p_decision: input.decision,
      p_reason: input.reason ?? null,
      p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "event_program.review_rejected", {
        requestId, userId: user.id, programId: id, decision: input.decision, code: error.message,
      });
      throw eventProgramRpcError(error.message);
    }
    logEvent("info", "event_program.reviewed", { requestId, userId: user.id, programId: id, status: data });
    return NextResponse.json(
      { status: data, message: resultMessages[data as string] ?? "Đã ghi nhận kết quả." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
