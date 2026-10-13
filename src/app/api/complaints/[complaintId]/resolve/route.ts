import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { resolveComplaintSchema } from "@/modules/program-acceptance/schemas";

// BTC xử lý khiếu nại. Chấp nhận → bổ sung điểm danh đúng lượt và tính lại kết quả (hoàn uy tín do DB ghi).
export async function POST(request: Request, { params }: { params: Promise<{ complaintId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const complaintId = z.uuid().parse((await params).complaintId);
    const input = resolveComplaintSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("resolve_attendance_complaint", {
      p_complaint_id: complaintId, p_decision: input.decision, p_reason: input.reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_acceptance.complaint_resolve_rejected", { requestId, userId: user.id, complaintId, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "program_acceptance.complaint_resolved", { requestId, userId: user.id, complaintId, decision: input.decision });
    return NextResponse.json(
      { message: input.decision === "accept" ? "Đã chấp nhận và bổ sung điểm danh." : "Đã từ chối khiếu nại." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
