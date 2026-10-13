import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("submit_program_acceptance", { p_program_id: id, p_request_id: requestId });
    if (error) {
      logEvent("warn", "program_acceptance.submit_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "program_acceptance.submitted", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ message: "Đã nộp hồ sơ nghiệm thu cho Văn phòng." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
