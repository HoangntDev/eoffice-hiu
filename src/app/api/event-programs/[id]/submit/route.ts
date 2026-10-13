import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { eventProgramRpcError } from "@/modules/event-programs/errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("submit_event_program", { p_program_id: id, p_request_id: requestId });
    if (error) {
      logEvent("warn", "event_program.submit_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw eventProgramRpcError(error.message);
    }
    logEvent("info", "event_program.submitted", { requestId, userId: user.id, programId: id });
    return NextResponse.json(
      { status: data, message: "Đã gửi kế hoạch đến Văn phòng Đoàn – Hội." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
