import { describe, expect, it } from "vitest";
import {
  buildAudienceRule, describeAudience, parseAudienceRule, parseQuotaRule, quotaRule,
} from "@/modules/program-registrations/audience";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import { buildRegistrationCsv, type RegistrationListRow } from "@/modules/program-registrations/export";
import {
  decideRegistrationSchema, registerSchema, saveRegistrationSettingsSchema,
} from "@/modules/program-registrations/schemas";

const FAC_A = "11111111-1111-4111-8111-111111111111";
const MAJOR_A = "22222222-2222-4222-8222-222222222222";

describe("UC7 cấu hình đăng ký", () => {
  const base = { audienceRule: { type: "hiu_student" as const }, requiresApproval: false };

  it("chấp nhận không giới hạn chỗ, không chỉ tiêu", () => {
    expect(saveRegistrationSettingsSchema.parse(base).quotas).toEqual([]);
  });

  it("chặn chỉ tiêu nhóm khi không có tổng số chỗ", () => {
    const result = saveRegistrationSettingsSchema.safeParse({
      ...base, quotas: [{ label: "Khoa A", audienceRule: { type: "faculty", faculty_id: FAC_A }, seats: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("chặn tổng chỉ tiêu nhóm vượt tổng số chỗ", () => {
    const result = saveRegistrationSettingsSchema.safeParse({
      ...base, capacity: 5, quotas: [{ label: "Khoa A", audienceRule: { type: "faculty", faculty_id: FAC_A }, seats: 6 }],
    });
    expect(result.success).toBe(false);
  });

  it("chặn hạn chuyển chỉ tiêu khi không có nhóm", () => {
    expect(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 5, quotaReleaseAt: "2026-11-01T08:00:00+07:00" }).success).toBe(false);
  });

  it("nhận điều kiện theo ngành", () => {
    expect(saveRegistrationSettingsSchema.safeParse({ ...base, audienceRule: { type: "major", program_id: MAJOR_A } }).success).toBe(true);
  });
});

describe("UC7 duyệt và đăng ký", () => {
  it("từ chối phải có lý do ≥ 10 ký tự", () => {
    expect(decideRegistrationSchema.safeParse({ decision: "reject", reason: "ngắn" }).success).toBe(false);
    expect(decideRegistrationSchema.safeParse({ decision: "reject", reason: "Đã đủ người tham gia" }).success).toBe(true);
  });

  it("duyệt không bắt buộc lý do ở client (server quyết định khi bỏ qua người uy tín cao)", () => {
    expect(decideRegistrationSchema.parse({ decision: "approve" }).reason).toBeNull();
  });

  it("không nhận trường lạ như user_id hay status từ client", () => {
    expect(registerSchema.safeParse({ answers: [], status: "accepted" }).success).toBe(false);
  });

  it("ánh xạ lỗi RPC sang thông báo tiếng Việt", () => {
    expect(registrationRpcError("SKIP_REASON_REQUIRED").status).toBe(422);
    expect(registrationRpcError("REGISTRATION_FULL").code).toBe("REGISTRATION_FULL");
    expect(registrationRpcError("ALREADY_REGISTERED").status).toBe(409);
    expect(registrationRpcError("something else").status).toBe(500);
  });
});

describe("UC7 điều kiện đối tượng", () => {
  const names = { faculties: new Map([[FAC_A, "CNTT"]]), majors: new Map([[MAJOR_A, "Kỹ thuật phần mềm"]]) };

  it("mặc định là sinh viên HIU", () => {
    expect(buildAudienceRule({ facultyIds: [], majorIds: [], unionOnly: false })).toEqual({ type: "hiu_student" });
  });

  it("dựng và đọc lại Khoa/ngành/Đoàn viên", () => {
    const selection = { facultyIds: [FAC_A], majorIds: [MAJOR_A], unionOnly: true };
    const rule = buildAudienceRule(selection);
    expect(parseAudienceRule(rule)).toEqual(selection);
    expect(describeAudience(rule, names)).toBe("Sinh viên HIU · Khoa CNTT hoặc Ngành Kỹ thuật phần mềm · Đoàn viên");
  });

  it("nhóm chỉ tiêu đọc lại đúng loại", () => {
    expect(parseQuotaRule(quotaRule("major", MAJOR_A))).toEqual({ kind: "major", targetId: MAJOR_A });
    expect(parseQuotaRule(quotaRule("union_member", null))).toEqual({ kind: "union_member", targetId: null });
  });
});

describe("UC7 xuất danh sách", () => {
  const row: RegistrationListRow = {
    registration_id: "r1", user_id: "u1", student_code: "2260000001", full_name: "Nguyễn Văn A",
    class_code: "22DTH1", program_name: "KTPM", faculty_name: "CNTT", status: "accepted", quota_label: null,
    registered_at: "2026-10-15T01:00:00Z", decided_at: "2026-10-15T01:00:00Z", decision_reason: null,
    reputation_score: 95, suggested_rank: null, answers: { q1: "=HYPERLINK(\"x\")", q2: ["o1", "o2"] },
  };
  const questions = [
    { id: "q1", type: "short_text" as const, label: "Ghi chú", required: false, order: 0 },
    { id: "q2", type: "multi_choice" as const, label: "Buổi tham gia", required: false, order: 1,
      options: [{ id: "o1", label: "Sáng", order: 0 }, { id: "o2", label: "Chiều", order: 1 }] },
  ];
  const csv = buildRegistrationCsv([row], questions);

  it("không xuất điểm uy tín", () => {
    expect(csv).not.toContain("Uy tín");
    expect(csv).not.toContain("95");
  });

  it("đổi mã lựa chọn sang nhãn và chặn công thức Excel", () => {
    expect(csv).toContain("Sáng; Chiều");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("Đã xác nhận,Chung");
  });
});
