import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { attendanceRpcError } from "@/modules/program-attendance/errors";
import { checkInSchema } from "@/modules/program-attendance/schemas";

// Sinh viên tự điểm danh: chữ ký, đúng lượt, lượt đang mở, hạn 30 giây theo giờ server, đăng ký được nhận, không trùng.
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = checkInSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      // Token sai định dạng là mã QR không hợp lệ (422 QR_INVALID), không gửi xuống database (#61).
      if (parsed.error.issues.some((issue) => issue.path[0] === "token")) throw attendanceRpcError("QR_INVALID");
      throw parsed.error;
    }
    const input = parsed.data;
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("check_in_attendance", {
      p_session_id: input.sessionId, p_token: input.token, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_attendance.check_in_rejected", { requestId, userId: user.id, sessionId: input.sessionId, code: error.message });
      throw attendanceRpcError(error.message);
    }
    const result = data as { record_id: string; session_label: string; supplementary: boolean };
    logEvent("info", "program_attendance.checked_in", { requestId, userId: user.id, sessionId: input.sessionId, supplementary: result.supplementary });
    return NextResponse.json(
      { ...result, message: `Đã điểm danh lượt "${result.session_label}"${result.supplementary ? " (bổ sung)" : ""}.` },
      { status: 201, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
