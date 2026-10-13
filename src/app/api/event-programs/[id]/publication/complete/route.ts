import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { publicationRpcError } from "@/modules/program-publication/errors";

// Đánh dấu Đã đăng bài: DB kiểm đủ tiêu đề, nội dung, ảnh, bài E-Office, URL và thời gian Facebook.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("complete_program_publication", { p_program_id: id, p_request_id: requestId });
    if (error) {
      logEvent("warn", "program_publication.complete_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw publicationRpcError(error.message);
    }
    logEvent("info", "program_publication.completed", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ message: "Đã đánh dấu chương trình Đã đăng bài." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
