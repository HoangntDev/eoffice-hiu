import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { createAdminSupabase } from "@/lib/supabase/server";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { checkAcceptanceFile, MAX_ACCEPTANCE_FILE_BYTES } from "@/modules/program-acceptance/files";
import { documentKinds } from "@/modules/program-acceptance/schemas";

const BUCKET = "program-acceptance-files";
const MULTIPART_OVERHEAD = 64 * 1024;

// multipart: kind = proposal | report | evidence, file. Mỗi lần tải là một phiên bản mới; bản cũ được giữ.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    if (Number(request.headers.get("content-length") ?? "0") > MAX_ACCEPTANCE_FILE_BYTES + MULTIPART_OVERHEAD) {
      throw new HttpError(413, "FILE_TOO_LARGE", "Tệp vượt quá 5MB.");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "INVALID_MULTIPART", "Không đọc được tệp tải lên.");
    }
    const kind = z.enum(documentKinds).parse(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "FILE_REQUIRED", "Chọn tệp để tải lên.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkAcceptanceFile(kind, { name: file.name, type: file.type, size: bytes.byteLength }, bytes.subarray(0, 12));
    if (!check.ok) throw new HttpError(check.code === "FILE_TOO_LARGE" ? 413 : 422, check.code, check.message);

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const storagePath = `${id}/${crypto.randomUUID()}.${check.ext}`;
    // Tải bằng phiên người dùng: Storage RLS chỉ cho BTC của chương trình khi hồ sơ còn sửa được.
    const { error: uploadError } = await supabase.storage
      .from(BUCKET).upload(storagePath, bytes, { contentType: check.contentType, upsert: false });
    if (uploadError) {
      logEvent("warn", "program_acceptance.document_upload_denied", { requestId, userId: user.id, programId: id, reason: uploadError.message });
      throw new HttpError(403, "FORBIDDEN", "Bạn không thể tải tệp cho hồ sơ này ở trạng thái hiện tại.");
    }
    const { data: documentId, error } = await supabase.rpc("attach_program_acceptance_document", {
      p_program_id: id, p_kind: kind, p_storage_path: storagePath, p_file_name: check.fileName,
      p_content_type: check.contentType, p_size_bytes: bytes.byteLength, p_sha256: sha256, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_acceptance.document_attach_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      try {
        await createAdminSupabase().storage.from(BUCKET).remove([storagePath]);
      } catch {
        logEvent("error", "program_acceptance.document_orphan", { requestId, storagePath });
      }
      throw acceptanceRpcError(error.message);
    }
    logEvent("info", "program_acceptance.document_attached", { requestId, userId: user.id, programId: id, documentId, kind, sha256 });
    return NextResponse.json({ id: documentId, sha256, message: "Đã tải tệp vào hồ sơ." }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
