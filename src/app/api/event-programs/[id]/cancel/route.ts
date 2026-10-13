import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { cancelProgramSchema } from "@/modules/program-acceptance/schemas";

// Hủy chương trình đã chấp thuận (BCH Đoàn Khoa sở hữu hoặc Văn phòng), trước khi nghiệm thu. Không trừ uy tín.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = cancelProgramSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("cancel_event_program", { p_program_id: id, p_reason: input.reason, p_request_id: requestId });
    if (error) {
      logEvent("warn", "event_program.cancel_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "event_program.cancelled", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ message: "Đã hủy chương trình." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
