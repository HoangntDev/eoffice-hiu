import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { withdrawDocumentSchema } from "@/modules/program-acceptance/schemas";

// Rút tệp khỏi hồ sơ (có lý do). Tệp và bản ghi vẫn được giữ để đối chiếu lịch sử.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const raw = await params;
    const id = z.uuid().parse(raw.id);
    const documentId = z.uuid().parse(raw.documentId);
    const input = withdrawDocumentSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("withdraw_program_acceptance_document", {
      p_document_id: documentId, p_reason: input.reason, p_request_id: requestId,
    });
    if (error) throw acceptanceRpcError(error.message);
    logEvent("info", "program_acceptance.document_withdrawn", { requestId, userId: user.id, programId: id, documentId });
    return NextResponse.json({ message: "Đã rút tệp khỏi hồ sơ." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
