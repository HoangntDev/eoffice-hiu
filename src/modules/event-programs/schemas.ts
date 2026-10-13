import { z } from "zod";

export const eventProgramStatuses = ["draft", "submitted", "needs_changes", "approved", "rejected", "cancelled"] as const;
export type EventProgramStatus = (typeof eventProgramStatuses)[number];

const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

export const saveEventProgramSchema = z
  .object({
    ownerOrgId: z.uuid().optional(),
    title: z.string().trim().min(5, "Tên chương trình tối thiểu 5 ký tự.").max(200),
    summary: optionalText(5000),
    location: optionalText(300),
    startsAt: z.iso.datetime({ offset: true }).nullish(),
    endsAt: z.iso.datetime({ offset: true }).nullish(),
    expectedParticipants: z.number().int().min(1).max(100000).nullish(),
    planNumber: optionalText(100),
    planSignedOn: z.iso.date().nullish(),
  })
  .strict()
  .refine((input) => !input.startsAt || !input.endsAt || new Date(input.endsAt) > new Date(input.startsAt), {
    path: ["endsAt"],
    message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
  });

export type SaveEventProgramInput = z.infer<typeof saveEventProgramSchema>;

export const reviewDecisions = ["approve", "request_changes", "reject"] as const;

export const reviewEventProgramSchema = z
  .object({
    decision: z.enum(reviewDecisions),
    reason: z.string().trim().max(2000).nullish(),
  })
  .strict()
  .refine((input) => input.decision === "approve" || (input.reason ?? "").length >= 10, {
    path: ["reason"],
    message: "Yêu cầu chỉnh sửa hoặc từ chối phải ghi lý do (tối thiểu 10 ký tự).",
  });

export const statusLabels: Record<EventProgramStatus, string> = {
  draft: "Bản nháp",
  submitted: "Chờ Văn phòng xét",
  needs_changes: "Cần chỉnh sửa",
  approved: "Đã chấp thuận",
  rejected: "Bị từ chối",
  cancelled: "Đã hủy",
};

export const requiredFieldLabels: Record<string, string> = {
  summary: "Nội dung",
  location: "Địa điểm",
  starts_at: "Thời gian bắt đầu",
  ends_at: "Thời gian kết thúc",
  expected_participants: "Số người dự kiến",
  plan_number: "Số kế hoạch",
  plan_signed_on: "Ngày ký",
};
