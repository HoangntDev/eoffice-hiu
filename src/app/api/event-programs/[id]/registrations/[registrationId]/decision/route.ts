import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import { decideRegistrationSchema } from "@/modules/program-registrations/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; registrationId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const { id, registrationId } = await params;
    const programId = z.uuid().parse(id);
    const regId = z.uuid().parse(registrationId);
    const input = decideRegistrationSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("decide_program_registration", {
      p_registration_id: regId, p_decision: input.decision, p_reason: input.reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_registration.decision_rejected", {
        requestId, userId: user.id, programId, registrationId: regId, decision: input.decision, code: error.message,
      });
      throw registrationRpcError(error.message);
    }
    logEvent("info", "program_registration.decided", { requestId, userId: user.id, programId, registrationId: regId, status: data });
    return NextResponse.json(
      { status: data, message: data === "accepted" ? "Đã duyệt đăng ký." : "Đã từ chối đăng ký." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
