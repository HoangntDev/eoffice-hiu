import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { lockSchema } from "@/modules/program-acceptance/schemas";

// BTC khóa điểm danh để lập hồ sơ nghiệm thu, hoặc mở khóa (có lý do) khi hồ sơ chưa nộp.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = lockSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = input.action === "lock"
      ? await supabase.rpc("lock_program_attendance", { p_program_id: id, p_request_id: requestId })
      : await supabase.rpc("unlock_program_attendance", { p_program_id: id, p_reason: input.reason, p_request_id: requestId });
    if (error) {
      logEvent("warn", `program_acceptance.${input.action}_rejected`, { requestId, userId: user.id, programId: id, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", `program_acceptance.attendance_${input.action}ed`, { requestId, userId: user.id, programId: id });
    return NextResponse.json(
      { message: input.action === "lock" ? "Đã khóa điểm danh." : "Đã mở khóa điểm danh." },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
