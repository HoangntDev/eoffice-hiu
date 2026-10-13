import { describe, expect, it } from "vitest";
import { attendanceRpcError } from "@/modules/program-attendance/errors";
import { checkInSchema, saveAttendancePlanSchema, setSessionStatusSchema } from "@/modules/program-attendance/schemas";

const SID = "11111111-1111-4111-8111-111111111111";
const session = (label: string, points = 0, isRequired = false) => ({ label, points, isRequired });

describe("UC8 kế hoạch điểm danh", () => {
  it("điểm tối đa và điểm lượt phải là số nguyên", () => {
    expect(saveAttendancePlanSchema.safeParse({ maxPoints: 2.5, ruleType: "any_session", sessions: [session("Đầu giờ")] }).success).toBe(false);
    expect(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "sum_sessions", sessions: [session("Đầu giờ", 1.5)] }).success).toBe(false);
  });

  it("điểm lượt và điểm bậc không vượt điểm tối đa", () => {
    expect(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "sum_sessions", sessions: [session("Đầu giờ", 4)] }).success).toBe(false);
    expect(saveAttendancePlanSchema.safeParse({
      maxPoints: 3, ruleType: "tiers", tiers: [{ minSessions: 1, points: 4 }], sessions: [session("Đầu giờ")],
    }).success).toBe(false);
  });

  it("bậc không được cần nhiều lượt hơn số lượt cấu hình, không trùng", () => {
    const base = { maxPoints: 3, ruleType: "tiers" as const, sessions: [session("Lượt A"), session("Lượt B")] };
    expect(saveAttendancePlanSchema.safeParse({ ...base, tiers: [{ minSessions: 3, points: 3 }] }).success).toBe(false);
    expect(saveAttendancePlanSchema.safeParse({ ...base, tiers: [{ minSessions: 1, points: 1 }, { minSessions: 1, points: 2 }] }).success).toBe(false);
    expect(saveAttendancePlanSchema.safeParse({ ...base, tiers: [{ minSessions: 1, points: 1 }, { minSessions: 2, points: 3 }] }).success).toBe(true);
  });

  it("quy tắc đủ lượt bắt buộc cần ít nhất một lượt bắt buộc", () => {
    expect(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "all_required", sessions: [session("Lượt A")] }).success).toBe(false);
    expect(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "all_required", sessions: [session("Lượt A", 0, true)] }).success).toBe(true);
  });

  it("mở lại lượt nhận lý do tùy chọn ở client (server bắt buộc khi mở lại)", () => {
    expect(setSessionStatusSchema.parse({ status: "open", reason: "  " }).reason).toBeNull();
  });
});

describe("UC8 mã QR", () => {
  const token = `${SID}.2.1792000000000.${"a".repeat(32)}`;

  it("nhận đúng định dạng token, từ chối mã bị cắt hoặc lạ", () => {
    expect(checkInSchema.safeParse({ sessionId: SID, token }).success).toBe(true);
    expect(checkInSchema.safeParse({ sessionId: SID, token: token.slice(0, -1) }).success).toBe(false);
    expect(checkInSchema.safeParse({ sessionId: SID, token: "javascript:alert(1)" }).success).toBe(false);
  });

  it("ánh xạ lỗi hết hạn sang 410 và yêu cầu quét mã mới", () => {
    const error = attendanceRpcError("QR_EXPIRED");
    expect(error.status).toBe(410);
    expect(error.message).toContain("quét mã mới");
    expect(attendanceRpcError("ALREADY_CHECKED_IN").status).toBe(409);
    expect(attendanceRpcError("AMEND_FORBIDDEN").code).toBe("AMEND_FORBIDDEN");
  });
});
