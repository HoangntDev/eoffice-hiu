import { z } from "zod";

const reason = z.string().trim().min(10, "Lý do tối thiểu 10 ký tự.").max(2000);
const optionalReason = z.string().trim().max(2000).nullish().transform((value) => value || null);

export const acceptanceStatuses = ["draft", "submitted", "needs_changes", "accepted", "rejected"] as const;
export type AcceptanceStatus = (typeof acceptanceStatuses)[number];
export const documentKinds = ["proposal", "report", "evidence"] as const;
export type DocumentKind = (typeof documentKinds)[number];

export const lockSchema = z
  .object({ action: z.enum(["lock", "unlock"]), reason: optionalReason })
  .strict()
  .refine((input) => input.action === "lock" || (input.reason ?? "").length >= 10, {
    path: ["reason"],
    message: "Mở khóa điểm danh phải ghi lý do (tối thiểu 10 ký tự).",
  });

export const withdrawDocumentSchema = z.object({ reason }).strict();

export const reviewAcceptanceSchema = z
  .object({ decision: z.enum(["accept", "request_changes", "reject"]), reason: optionalReason })
  .strict()
  .refine((input) => input.decision === "accept" || (input.reason ?? "").length >= 10, {
    path: ["reason"],
    message: "Yêu cầu bổ sung hoặc từ chối phải ghi lý do (tối thiểu 10 ký tự).",
  });

export const fileComplaintSchema = z
  .object({ sessionId: z.uuid(), message: z.string().trim().min(10, "Nội dung khiếu nại tối thiểu 10 ký tự.").max(2000) })
  .strict();

export const resolveComplaintSchema = z.object({ decision: z.enum(["accept", "reject"]), reason }).strict();

export const cancelProgramSchema = z.object({ reason }).strict();

export const academicTermSchema = z
  .object({
    id: z.uuid().nullish(),
    academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, "Năm học dạng 2026-2027.")
      .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1, "Năm sau phải lớn hơn năm trước 1."),
    termCode: z.string().trim().min(1).max(20),
    name: z.string().trim().min(2).max(100),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
  })
  .strict()
  .refine((input) => input.endsOn >= input.startsOn, { path: ["endsOn"], message: "Ngày kết thúc phải sau ngày bắt đầu." });

export const acceptanceStatusLabels: Record<AcceptanceStatus, string> = {
  draft: "Đã khóa điểm danh, đang lập hồ sơ",
  submitted: "Chờ Văn phòng nghiệm thu",
  needs_changes: "Văn phòng yêu cầu bổ sung",
  accepted: "Đã nghiệm thu",
  rejected: "Không nghiệm thu",
};

export const documentKindLabels: Record<DocumentKind, string> = {
  proposal: "Đơn đề nghị cấp điểm (có chữ ký Trưởng BTC, PDF scan)",
  report: "Báo cáo kết quả (PDF)",
  evidence: "Ảnh minh chứng (JPG/PNG/WEBP hoặc PDF)",
};

export const complaintStatusLabels: Record<string, string> = {
  pending: "Chờ BTC xử lý",
  accepted: "Đã chấp nhận, đã bổ sung điểm danh",
  rejected: "Không chấp nhận",
};

export const acceptanceActionLabels: Record<string, string> = {
  attendance_locked: "Khóa điểm danh",
  attendance_unlocked: "Mở khóa điểm danh",
  document_uploaded: "Tải tệp hồ sơ",
  document_replaced: "Tải phiên bản mới thay bản cũ",
  document_withdrawn: "Rút tệp khỏi hồ sơ",
  submitted: "Nộp hồ sơ nghiệm thu",
  changes_requested: "Văn phòng yêu cầu bổ sung",
  rejected: "Văn phòng không nghiệm thu",
  accepted: "Văn phòng nghiệm thu",
  complaint_filed: "Sinh viên gửi khiếu nại điểm danh",
  complaint_accepted: "BTC chấp nhận khiếu nại, bổ sung điểm danh",
  complaint_rejected: "BTC không chấp nhận khiếu nại",
};

export const missingLabels: Record<string, string> = {
  proposal: "Đơn đề nghị",
  report: "Báo cáo kết quả",
  evidence: "Ảnh minh chứng",
};
