import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { createAdminSupabase } from "@/lib/supabase/server";
import { eventProgramRpcError } from "@/modules/event-programs/errors";
import { checkPlanPdf, MAX_PLAN_PDF_BYTES } from "@/modules/event-programs/pdf";

const BUCKET = "event-program-plans";
const MULTIPART_OVERHEAD = 64 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_PLAN_PDF_BYTES + MULTIPART_OVERHEAD) {
      throw new HttpError(413, "FILE_TOO_LARGE", "Tệp PDF vượt quá 5MB.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "INVALID_MULTIPART", "Không đọc được tệp tải lên.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "FILE_REQUIRED", "Chọn tệp PDF kế hoạch đã ký.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkPlanPdf({ name: file.name, type: file.type, size: bytes.byteLength }, bytes.subarray(0, 5));
    if (!check.ok) {
      logEvent("warn", "event_program.document_invalid", { requestId, userId: user.id, programId: id, code: check.code });
      throw new HttpError(check.code === "FILE_TOO_LARGE" ? 413 : 422, check.code, check.message);
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const storagePath = `${id}/${crypto.randomUUID()}.pdf`;

    // Upload with the user's session so Storage RLS enforces faculty scope and editable status.
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      logEvent("warn", "event_program.document_upload_denied", {
        requestId, userId: user.id, programId: id, reason: uploadError.message,
      });
      throw new HttpError(403, "FORBIDDEN", "Bạn không thể tải tệp cho kế hoạch này ở trạng thái hiện tại.");
    }

    const { data: documentId, error } = await supabase.rpc("attach_event_program_document", {
      p_program_id: id,
      p_storage_path: storagePath,
      p_file_name: check.fileName,
      p_size_bytes: bytes.byteLength,
      p_sha256: sha256,
      p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "event_program.document_attach_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      try {
        await createAdminSupabase().storage.from(BUCKET).remove([storagePath]);
      } catch {
        logEvent("error", "event_program.document_orphan", { requestId, storagePath });
      }
      throw eventProgramRpcError(error.message);
    }

    logEvent("info", "event_program.document_attached", {
      requestId, userId: user.id, programId: id, documentId, sizeBytes: bytes.byteLength, sha256,
    });
    return NextResponse.json(
      { id: documentId, sha256, message: "Đã tải lên bản kế hoạch PDF." },
      { status: 201, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
