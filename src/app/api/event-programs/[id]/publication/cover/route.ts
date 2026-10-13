import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { createAdminSupabase } from "@/lib/supabase/server";
import { checkAcceptanceFile, MAX_ACCEPTANCE_FILE_BYTES } from "@/modules/program-acceptance/files";
import { publicationRpcError } from "@/modules/program-publication/errors";

const BUCKET = "program-publication-covers";
const MULTIPART_OVERHEAD = 64 * 1024;

// multipart: file (ảnh JPG/PNG/WEBP ≤ 5MB), reason (bắt buộc nếu bài đã lên E-Office). Ảnh cũ được giữ trong lịch sử.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const { user, supabase } = await requireUser();
    if (Number(request.headers.get("content-length") ?? "0") > MAX_ACCEPTANCE_FILE_BYTES + MULTIPART_OVERHEAD) {
      throw new HttpError(413, "FILE_TOO_LARGE", "Ảnh vượt quá 5MB.");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "INVALID_MULTIPART", "Không đọc được tệp tải lên.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "FILE_REQUIRED", "Chọn ảnh để tải lên.");
    const reason = typeof form.get("reason") === "string" ? String(form.get("reason")).trim() || null : null;

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Dùng chung bộ kiểm đuôi + MIME + chữ ký tệp của UC9, chỉ nhận ảnh.
    const check = checkAcceptanceFile("evidence", { name: file.name, type: file.type, size: bytes.byteLength }, bytes.subarray(0, 12));
    if (!check.ok) throw new HttpError(check.code === "FILE_TOO_LARGE" ? 413 : 422, check.code, check.message);
    if (check.ext === "pdf") throw new HttpError(422, "UNSUPPORTED_FILE", "Ảnh đại diện nhận JPG, PNG hoặc WEBP.");

    const storagePath = `${id}/${crypto.randomUUID()}.${check.ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET).upload(storagePath, bytes, { contentType: check.contentType, upsert: false });
    if (uploadError) {
      logEvent("warn", "program_publication.cover_upload_denied", { requestId, userId: user.id, programId: id, reason: uploadError.message });
      throw new HttpError(403, "FORBIDDEN", "Chỉ Ban Tuyên giáo – Truyền thông tải ảnh cho bài của chương trình đã nghiệm thu.");
    }
    const { data: version, error } = await supabase.rpc("set_program_publication_cover", {
      p_program_id: id, p_storage_path: storagePath, p_content_type: check.contentType, p_reason: reason, p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_publication.cover_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      try {
        await createAdminSupabase().storage.from(BUCKET).remove([storagePath]);
      } catch {
        logEvent("error", "program_publication.cover_orphan", { requestId, storagePath });
      }
      throw publicationRpcError(error.message);
    }
    logEvent("info", "program_publication.cover_set", { requestId, userId: user.id, programId: id, version });
    return NextResponse.json({ version, message: "Đã đặt ảnh đại diện." }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
