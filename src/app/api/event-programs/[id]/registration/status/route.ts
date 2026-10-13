import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import { setRegistrationStatusSchema } from "@/modules/program-registrations/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = setRegistrationStatusSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("set_program_registration_status", {
      p_program_id: id, p_status: input.status, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_registration.status_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw registrationRpcError(error.message);
    }
    logEvent("info", "program_registration.status_changed", { requestId, userId: user.id, programId: id, status: data });
    return NextResponse.json(
      { status: data, message: data === "open" ? "Đã mở đăng ký." : "Đã đóng đăng ký." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
