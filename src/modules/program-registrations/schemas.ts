import { z } from "zod";
import { audienceRuleSchema } from "@/modules/forms/schemas";

export const registrationStatuses = ["pending", "accepted", "rejected"] as const;
export type RegistrationStatus = (typeof registrationStatuses)[number];

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  pending: "Chờ BTC duyệt",
  accepted: "Đã xác nhận",
  rejected: "Không được duyệt",
};

export type SettingsStatus = "draft" | "open" | "closed";

export const settingsStatusLabels: Record<SettingsStatus, string> = {
  draft: "Chưa mở đăng ký",
  open: "Đang mở đăng ký",
  closed: "Đã đóng đăng ký",
};

const quotaSchema = z
  .object({
    id: z.uuid().nullish(),
    label: z.string().trim().min(2, "Tên nhóm tối thiểu 2 ký tự.").max(120),
    audienceRule: audienceRuleSchema,
    seats: z.number().int().min(1).max(100000),
    sortOrder: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export const saveRegistrationSettingsSchema = z
  .object({
    audienceRule: audienceRuleSchema,
    capacity: z.number().int().min(1).max(100000).nullish(),
    requiresApproval: z.boolean(),
    formId: z.uuid().nullish(),
    closesAt: z.iso.datetime({ offset: true }).nullish(),
    quotaReleaseAt: z.iso.datetime({ offset: true }).nullish(),
    instructions: z.string().trim().max(2000).nullish().transform((value) => (value ? value : null)),
    quotas: z.array(quotaSchema).max(50).default([]),
  })
  .strict()
  .refine((input) => input.quotas.length === 0 || input.capacity != null, {
    path: ["quotas"],
    message: "Chia chỉ tiêu cần đặt tổng số chỗ.",
  })
  .refine((input) => input.capacity == null || input.quotas.reduce((sum, q) => sum + q.seats, 0) <= input.capacity, {
    path: ["quotas"],
    message: "Tổng chỉ tiêu các nhóm vượt tổng số chỗ.",
  })
  .refine((input) => !input.quotaReleaseAt || input.quotas.length > 0, {
    path: ["quotaReleaseAt"],
    message: "Chỉ đặt hạn chuyển chỉ tiêu khi có nhóm chỉ tiêu.",
  });

export type SaveRegistrationSettingsInput = z.infer<typeof saveRegistrationSettingsSchema>;

export const setRegistrationStatusSchema = z.object({ status: z.enum(["open", "closed"]) }).strict();

export const registerSchema = z
  .object({
    answers: z.array(z.object({ question_id: z.string().min(1), answer_value: z.unknown().nullable() })).max(200).default([]),
    identity_snapshot: z.record(z.string(), z.unknown()).nullish(),
    respondent_email: z.null().optional(),
  })
  .strict();

export const decideRegistrationSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(2000).nullish().transform((value) => (value ? value : null)),
  })
  .strict()
  .refine((input) => input.decision === "approve" || (input.reason?.length ?? 0) >= 10, {
    path: ["reason"],
    message: "Từ chối phải ghi lý do (tối thiểu 10 ký tự).",
  });
