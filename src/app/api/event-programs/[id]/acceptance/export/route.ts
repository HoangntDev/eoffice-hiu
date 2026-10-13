import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { buildAcceptanceCsv, type AcceptanceAttendanceRow } from "@/modules/program-acceptance/export";

// Bảng dữ liệu lập Đơn đề nghị cấp điểm (CSV). BTC hoặc Văn phòng khi hồ sơ đã nộp.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("program_acceptance_attendance", { p_program_id: id });
    if (error) throw acceptanceRpcError(error.message);
    const rows = (data ?? []) as AcceptanceAttendanceRow[];
    logEvent("info", "program_acceptance.exported", { requestId, userId: user.id, programId: id, rows: rows.length });
    return new NextResponse(buildAcceptanceCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="de-nghi-diem-du-kien-${id.slice(0, 8)}.csv"`,
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
