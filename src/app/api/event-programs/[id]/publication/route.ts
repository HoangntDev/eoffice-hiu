import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { publicationRpcError } from "@/modules/program-publication/errors";
import { savePublicationSchema } from "@/modules/program-publication/schemas";

// Ban Tuyên giáo – Truyền thông lưu tiêu đề và nội dung (tự viết, sinh từ dữ liệu, hoặc từ đề xuất của Khoa).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = savePublicationSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data: version, error } = await supabase.rpc("save_program_publication", {
      p_program_id: id, p_title: input.title, p_body: input.body, p_source: input.source,
      p_proposal_id: input.proposalId ?? null, p_reason: input.reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_publication.save_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw publicationRpcError(error.message);
    }
    logEvent("info", "program_publication.saved", { requestId, userId: user.id, programId: id, version, source: input.source });
    return NextResponse.json({ version, message: `Đã lưu bài (phiên bản ${version}).` }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
