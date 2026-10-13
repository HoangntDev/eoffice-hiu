import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { academicTermSchema } from "@/modules/program-acceptance/schemas";

// Tạo hoặc sửa học kỳ (Đoàn Trường / Văn phòng). DB chặn chồng ngày và đổi ngày học kỳ đã dùng.
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const input = academicTermSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_academic_term", {
      p_id: input.id ?? null, p_academic_year: input.academicYear, p_term_code: input.termCode, p_name: input.name,
      p_starts_on: input.startsOn, p_ends_on: input.endsOn, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "academic_term.save_rejected", { requestId, userId: user.id, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "academic_term.saved", { requestId, userId: user.id, termId: data });
    return NextResponse.json({ id: data, message: "Đã lưu học kỳ." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
