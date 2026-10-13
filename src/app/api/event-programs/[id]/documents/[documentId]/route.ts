import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError } from "@/lib/http";

// Short-lived signed URL; the document row and the storage object are both checked by RLS.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const raw = await params;
    const id = z.uuid().parse(raw.id);
    const documentId = z.uuid().parse(raw.documentId);
    const { supabase } = await requireUser();
    const { data: document } = await supabase
      .from("event_program_documents")
      .select("storage_path, original_file_name")
      .eq("id", documentId)
      .eq("program_id", id)
      .maybeSingle();
    if (!document) throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tệp hoặc bạn không có quyền xem.");
    const { data, error } = await supabase.storage
      .from("event-program-plans")
      .createSignedUrl(document.storage_path, 60, { download: document.original_file_name });
    if (error || !data) throw new HttpError(403, "FORBIDDEN", "Không thể mở tệp kế hoạch.");
    return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
