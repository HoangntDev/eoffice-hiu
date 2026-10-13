import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { publicationRpcError } from "@/modules/program-publication/errors";
import { proposalSchema } from "@/modules/program-publication/schemas";

// BTC (Đoàn Khoa) gửi nội dung đề xuất; Ban Tuyên giáo quyết định có dùng hay không.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = proposalSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data: proposalId, error } = await supabase.rpc("submit_publication_proposal", {
      p_program_id: id, p_title: input.title, p_body: input.body, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_publication.proposal_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw publicationRpcError(error.message);
    }
    logEvent("info", "program_publication.proposal_submitted", { requestId, userId: user.id, programId: id, proposalId });
    return NextResponse.json({ id: proposalId, message: "Đã gửi nội dung đề xuất cho Ban Tuyên giáo – Truyền thông." },
      { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
