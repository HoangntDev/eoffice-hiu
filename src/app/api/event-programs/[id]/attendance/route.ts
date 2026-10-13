import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { attendanceRpcError } from "@/modules/program-attendance/errors";
import { saveAttendancePlanSchema } from "@/modules/program-attendance/schemas";

// BTC lưu kế hoạch điểm danh. Sau khi đã mở lượt, RPC chỉ cho faculty_manager điều chỉnh, kèm lý do.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = saveAttendancePlanSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("save_attendance_plan", {
      p_program_id: id,
      p_max_points: input.maxPoints,
      p_rule_type: input.ruleType,
      p_tiers: input.tiers.map((t) => ({ min_sessions: t.minSessions, points: t.points })),
      p_tiers_require_required: input.tiersRequireRequired,
      p_sessions: input.sessions.map((s, index) => ({
        id: s.id ?? null, label: s.label, points: s.points, is_required: s.isRequired, sort_order: index,
      })),
      p_reason: input.reason,
      p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_attendance.plan_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw attendanceRpcError(error.message);
    }
    logEvent("info", "program_attendance.plan_saved", { requestId, userId: user.id, programId: id, amended: Boolean(input.reason) });
    return NextResponse.json({ message: "Đã lưu kế hoạch điểm danh." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
