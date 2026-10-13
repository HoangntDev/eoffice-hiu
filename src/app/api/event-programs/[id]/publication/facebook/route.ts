import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { fromVietnamInputValue } from "@/modules/event-programs/dates";
import { publicationRpcError } from "@/modules/program-publication/errors";
import { facebookPostSchema } from "@/modules/program-publication/schemas";

// Ban đăng tay trên Facebook rồi ghi đường dẫn và thời gian thực tế (chưa tích hợp Facebook API).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = facebookPostSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("record_program_facebook_post", {
      p_program_id: id, p_url: input.url, p_posted_at: fromVietnamInputValue(input.postedAt),
      p_reason: input.reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_publication.facebook_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw publicationRpcError(error.message);
    }
    logEvent("info", "program_publication.facebook_recorded", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ message: "Đã ghi bài Facebook." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
