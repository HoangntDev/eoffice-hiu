// proxy.ts buffers request bodies up to 10MB (Next 16 default), so the plan limit stays well below it.
export const MAX_PLAN_PDF_BYTES = 5 * 1024 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export type PlanPdfCheck =
  | { ok: true; fileName: string }
  | { ok: false; code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "NOT_PDF"; message: string };

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "ke-hoach.pdf").slice(-255);
}

export function checkPlanPdf(file: { name: string; type: string; size: number }, head: Uint8Array): PlanPdfCheck {
  if (file.size <= 0) return { ok: false, code: "EMPTY_FILE", message: "Tệp PDF rỗng." };
  if (file.size > MAX_PLAN_PDF_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE", message: "Tệp PDF vượt quá 5MB." };
  }
  const fileName = sanitizeFileName(file.name);
  const looksPdf =
    fileName.toLowerCase().endsWith(".pdf") &&
    file.type === "application/pdf" &&
    PDF_MAGIC.every((byte, index) => head[index] === byte);
  if (!looksPdf) {
    return { ok: false, code: "NOT_PDF", message: "Chỉ nhận bản kế hoạch định dạng PDF." };
  }
  return { ok: true, fileName };
}
