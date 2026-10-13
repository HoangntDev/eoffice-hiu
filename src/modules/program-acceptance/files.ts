import { sanitizeFileName } from "@/modules/event-programs/pdf";
import type { DocumentKind } from "./schemas";

// proxy.ts đệm body tối đa 10MB; giới hạn tệp hồ sơ giữ ở 5MB như PDF kế hoạch (UC6).
export const MAX_ACCEPTANCE_FILE_BYTES = 5 * 1024 * 1024;

const types = [
  { contentType: "application/pdf", ext: "pdf", names: [".pdf"], magic: (h: Uint8Array) => ascii(h, 0, "%PDF-") },
  { contentType: "image/jpeg", ext: "jpg", names: [".jpg", ".jpeg"], magic: (h: Uint8Array) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
  { contentType: "image/png", ext: "png", names: [".png"], magic: (h: Uint8Array) => h[0] === 0x89 && ascii(h, 1, "PNG") },
  { contentType: "image/webp", ext: "webp", names: [".webp"], magic: (h: Uint8Array) => ascii(h, 0, "RIFF") && ascii(h, 8, "WEBP") },
] as const;

function ascii(bytes: Uint8Array, offset: number, text: string) {
  return [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

export type AcceptanceFileCheck =
  | { ok: true; fileName: string; contentType: string; ext: string }
  | { ok: false; code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_FILE"; message: string };

// Đơn đề nghị và báo cáo: chỉ PDF. Minh chứng: ảnh JPG/PNG/WEBP hoặc PDF. Kiểm cả đuôi, MIME và chữ ký tệp.
export function checkAcceptanceFile(kind: DocumentKind, file: { name: string; type: string; size: number }, head: Uint8Array): AcceptanceFileCheck {
  if (file.size <= 0) return { ok: false, code: "EMPTY_FILE", message: "Tệp rỗng." };
  if (file.size > MAX_ACCEPTANCE_FILE_BYTES) return { ok: false, code: "FILE_TOO_LARGE", message: "Tệp vượt quá 5MB." };
  const fileName = sanitizeFileName(file.name);
  const lower = fileName.toLowerCase();
  const allowed = kind === "evidence" ? types : types.filter((t) => t.ext === "pdf");
  const match = allowed.find((t) => t.contentType === file.type && t.names.some((n) => lower.endsWith(n)) && t.magic(head));
  if (!match) {
    return {
      ok: false,
      code: "UNSUPPORTED_FILE",
      message: kind === "evidence" ? "Minh chứng nhận ảnh JPG, PNG, WEBP hoặc PDF." : "Đơn đề nghị và báo cáo phải là PDF.",
    };
  }
  return { ok: true, fileName, contentType: match.contentType, ext: match.ext };
}
