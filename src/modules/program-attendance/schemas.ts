import { z } from "zod";

export const attendanceRuleTypes = ["all_required", "any_session", "sum_sessions", "tiers"] as const;
export type AttendanceRuleType = (typeof attendanceRuleTypes)[number];

export const ruleLabels: Record<AttendanceRuleType, string> = {
  all_required: "Đủ các lượt bắt buộc thì được điểm tối đa",
  any_session: "Có mặt ít nhất một lượt thì được điểm tối đa",
  sum_sessions: "Cộng điểm từng lượt đã điểm danh",
  tiers: "Cấp điểm theo bậc số lượt",
};

export type Participation = "completed" | "participated" | "absent";
export const participationLabels: Record<Participation, string> = {
  completed: "Hoàn thành",
  participated: "Có tham gia",
  absent: "Đăng ký nhưng không tham gia",
};

export type SessionStatus = "draft" | "open" | "closed";
export const sessionStatusLabels: Record<SessionStatus, string> = {
  draft: "Chưa mở",
  open: "Đang mở",
  closed: "Đã đóng",
};

const points = z.number().int("Điểm phải là số nguyên.").min(0).max(100);
const reason = z.string().trim().max(2000).nullish().transform((value) => (value ? value : null));

export const saveAttendancePlanSchema = z
  .object({
    maxPoints: points,
    ruleType: z.enum(attendanceRuleTypes),
    tiers: z.array(z.object({ minSessions: z.number().int().min(1).max(50), points }).strict()).max(20).default([]),
    tiersRequireRequired: z.boolean().default(false),
    sessions: z.array(z.object({
      id: z.uuid().nullish(),
      label: z.string().trim().min(2, "Tên lượt tối thiểu 2 ký tự.").max(120),
      points,
      isRequired: z.boolean(),
    }).strict()).min(1, "Cần ít nhất một lượt.").max(50),
    reason,
  })
  .strict()
  .refine((input) => input.sessions.every((s) => s.points <= input.maxPoints), {
    path: ["sessions"], message: "Điểm một lượt không được vượt điểm tối đa.",
  })
  .refine((input) => input.tiers.every((t) => t.points <= input.maxPoints && t.minSessions <= input.sessions.length), {
    path: ["tiers"], message: "Mỗi bậc phải có số lượt ≤ số lượt cấu hình và điểm ≤ điểm tối đa.",
  })
  .refine((input) => input.ruleType !== "tiers" || input.tiers.length > 0, {
    path: ["tiers"], message: "Quy tắc theo bậc cần ít nhất một bậc.",
  })
  .refine((input) => new Set(input.tiers.map((t) => t.minSessions)).size === input.tiers.length, {
    path: ["tiers"], message: "Mỗi bậc phải có số lượt khác nhau.",
  })
  .refine((input) => !(input.ruleType === "all_required" || (input.ruleType === "tiers" && input.tiersRequireRequired))
    || input.sessions.some((s) => s.isRequired), {
    path: ["sessions"], message: "Quy tắc này cần ít nhất một lượt bắt buộc.",
  });

export type SaveAttendancePlanInput = z.infer<typeof saveAttendancePlanSchema>;

export const setSessionStatusSchema = z.object({ status: z.enum(["open", "closed"]), reason }).strict();

// <session uuid>.<generation>.<issued_ms>.<chữ ký 32 hex>; chữ ký và hạn chỉ kiểm ở database.
export const attendanceTokenPattern = /^[0-9a-f-]{36}\.[0-9]{1,6}\.[0-9]{10,16}\.[0-9a-f]{32}$/;

export const checkInSchema = z.object({
  sessionId: z.uuid(),
  token: z.string().max(200).regex(attendanceTokenPattern, "Mã QR không hợp lệ."),
}).strict();
