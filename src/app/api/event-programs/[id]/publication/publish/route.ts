import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { publicationRpcError } from "@/modules/program-publication/errors";

// Hệ thống xuất bản bài trên cổng E-Office (/news/{id}).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("publish_program_eoffice", { p_program_id: id, p_request_id: requestId });
    if (error) {
      logEvent("warn", "program_publication.publish_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw publicationRpcError(error.message);
    }
    logEvent("info", "program_publication.eoffice_published", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ path: `/news/${id}`, message: "Đã xuất bản bài trên cổng E-Office." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
