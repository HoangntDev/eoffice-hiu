import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { attendanceRpcError } from "@/modules/program-attendance/errors";
import { setSessionStatusSchema } from "@/modules/program-attendance/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const sessionId = z.uuid().parse((await params).sessionId);
    const input = setSessionStatusSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("set_attendance_session_status", {
      p_session_id: sessionId, p_status: input.status, p_reason: input.reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_attendance.status_rejected", { requestId, userId: user.id, sessionId, code: error.message });
      throw attendanceRpcError(error.message);
    }
    logEvent("info", "program_attendance.status_changed", { requestId, userId: user.id, sessionId, status: data });
    return NextResponse.json(
      { status: data, message: data === "open" ? "Đã mở lượt điểm danh." : "Đã đóng lượt điểm danh." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
