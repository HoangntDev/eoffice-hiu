// Nhãn tiếng Việt cho trạng thái hồ sơ Đoàn viên (union_applications.status).
export const applicationStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  submitted: "Đã nộp, chờ xét",
  needs_changes: "Cần bổ sung",
  collaborator_recommended: "CTV đã đề xuất",
  office_review: "Văn phòng đang xét",
  recognized: "Đã công nhận",
  rejected: "Không công nhận",
  withdrawn_by_student: "Đã rút",
};

// Hồ sơ còn nằm trong hàng chờ xử lý của Văn phòng/CTV.
export const REVIEW_QUEUE_STATUSES = ["submitted", "collaborator_recommended", "office_review"] as const;

export function applicationStatusLabel(status: string | null | undefined): string {
  if (!status) return "Chưa khai báo";
  return applicationStatusLabels[status] ?? status;
}
