import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { fileComplaintSchema } from "@/modules/program-acceptance/schemas";

// Sinh viên khiếu nại thiếu điểm danh một lượt, sau nghiệm thu và trước khi hết học kỳ.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = fileComplaintSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("file_attendance_complaint", {
      p_program_id: id, p_session_id: input.sessionId, p_message: input.message, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_acceptance.complaint_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "program_acceptance.complaint_filed", { requestId, userId: user.id, programId: id, complaintId: data });
    return NextResponse.json({ id: data, message: "Đã gửi khiếu nại đến BTC." }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
