import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { reviewAcceptanceSchema } from "@/modules/program-acceptance/schemas";

const messages = {
  accept: "Đã nghiệm thu và chốt kết quả.",
  request_changes: "Đã yêu cầu BTC bổ sung hồ sơ.",
  reject: "Đã từ chối nghiệm thu.",
} as const;

// Chỉ Văn phòng Đoàn – Hội; RPC chặn người nộp/BTC tự nghiệm thu và báo thiếu cấu hình học kỳ.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = reviewAcceptanceSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("review_program_acceptance", {
      p_program_id: id, p_decision: input.decision, p_reason: input.reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_acceptance.review_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "program_acceptance.reviewed", { requestId, userId: user.id, programId: id, result: data });
    return NextResponse.json({ ...(data as object), message: messages[input.decision] }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
