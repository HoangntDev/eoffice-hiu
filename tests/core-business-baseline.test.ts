// Baseline TH1: chốt hành vi HIỆN TẠI của lớp kiểm tra dữ liệu vào (Zod) cho 3 nghiệp vụ cốt lõi
// — kế hoạch chương trình (UC6), đăng ký (UC7), điểm danh QR (UC8) — gồm ca thành công và ca biên/lỗi.
// Quy tắc nghiệp vụ đầy đủ nằm trong RPC PostgreSQL và được kiểm bằng pgTAP (supabase/tests/).
import { describe, expect, it } from "vitest";
import { formatVietnamDateTime, toVietnamInputValue } from "@/modules/event-programs/dates";
import { reviewEventProgramSchema, saveEventProgramSchema } from "@/modules/event-programs/schemas";
import { attendanceRpcError } from "@/modules/program-attendance/errors";
import {
  checkInSchema, saveAttendancePlanSchema, setSessionStatusSchema,
} from "@/modules/program-attendance/schemas";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import {
  decideRegistrationSchema, registerSchema, saveRegistrationSettingsSchema, setRegistrationStatusSchema,
} from "@/modules/program-registrations/schemas";

const SID = "11111111-1111-4111-8111-111111111111";
const FAC = "22222222-2222-4222-8222-222222222222";
const ok = (r: { success: boolean }) => expect(r.success).toBe(true);
const bad = (r: { success: boolean }) => expect(r.success).toBe(false);

describe("UC6 kế hoạch chương trình — saveEventProgramSchema", () => {
  const title = "Abcde"; // đúng 5 ký tự

  it("nhận bản nháp đầy đủ và chuẩn hóa chuỗi rỗng thành null", () => {
    const parsed = saveEventProgramSchema.parse({
      title: "  Ngày hội tình nguyện  ",
      summary: "   ",
      location: "Cơ sở 2",
      startsAt: "2026-11-20T08:00:00+07:00",
      endsAt: "2026-11-20T11:00:00+07:00",
      expectedParticipants: 100000,
      planNumber: "12-KH/ĐTN",
      planSignedOn: "2026-11-01",
    });
    expect(parsed.title).toBe("Ngày hội tình nguyện");
    expect(parsed.summary).toBeNull();
    expect(parsed.expectedParticipants).toBe(100000);
  });

  it("biên độ dài tên: 5 và 200 ký tự hợp lệ; 4 (sau trim) và 201 bị từ chối", () => {
    ok(saveEventProgramSchema.safeParse({ title }));
    ok(saveEventProgramSchema.safeParse({ title: "a".repeat(200) }));
    bad(saveEventProgramSchema.safeParse({ title: "  Abcd  " }));
    bad(saveEventProgramSchema.safeParse({ title: "a".repeat(201) }));
  });

  it("thời gian kết thúc bằng thời gian bắt đầu bị từ chối (phải sau hẳn)", () => {
    const at = "2026-11-20T08:00:00+07:00";
    const result = saveEventProgramSchema.safeParse({ title, startsAt: at, endsAt: at });
    bad(result);
    expect(result.error?.issues[0].message).toContain("phải sau");
  });

  it("so sánh thời gian theo thời điểm thật, không theo chuỗi múi giờ", () => {
    // 01:30Z = 08:30 giờ VN, sau 08:00+07:00
    ok(saveEventProgramSchema.safeParse({ title, startsAt: "2026-11-20T08:00:00+07:00", endsAt: "2026-11-20T01:30:00Z" }));
    bad(saveEventProgramSchema.safeParse({ title, startsAt: "2026-11-20T08:00:00+07:00", endsAt: "2026-11-20T00:30:00Z" }));
  });

  it("chỉ có một đầu thời gian thì không kiểm tra thứ tự", () => {
    ok(saveEventProgramSchema.safeParse({ title, endsAt: "2026-11-20T08:00:00+07:00" }));
  });

  it("thời gian phải có múi giờ; ngày ký phải là ngày ISO", () => {
    bad(saveEventProgramSchema.safeParse({ title, startsAt: "2026-11-20T08:00:00" }));
    bad(saveEventProgramSchema.safeParse({ title, planSignedOn: "01/11/2026" }));
  });

  it("số người dự kiến: 1 hợp lệ; 0 và 100001 bị từ chối", () => {
    ok(saveEventProgramSchema.safeParse({ title, expectedParticipants: 1 }));
    bad(saveEventProgramSchema.safeParse({ title, expectedParticipants: 0 }));
    bad(saveEventProgramSchema.safeParse({ title, expectedParticipants: 100001 }));
  });

  it("ownerOrgId phải là UUID", () => {
    bad(saveEventProgramSchema.safeParse({ title, ownerOrgId: "doan-khoa-cntt" }));
  });
});

describe("UC6 xét kế hoạch — reviewEventProgramSchema (chỉ Văn phòng xét, quyền kiểm ở DB)", () => {
  it("lý do đúng 10 ký tự sau trim là đủ; 9 ký tự bị từ chối", () => {
    ok(reviewEventProgramSchema.safeParse({ decision: "reject", reason: "  0123456789  " }));
    bad(reviewEventProgramSchema.safeParse({ decision: "reject", reason: "012345678" }));
  });

  it("chấp thuận vẫn giữ lý do nếu có; lý do quá 2000 ký tự bị từ chối", () => {
    expect(reviewEventProgramSchema.parse({ decision: "approve", reason: "Đầy đủ hồ sơ" }).reason).toBe("Đầy đủ hồ sơ");
    bad(reviewEventProgramSchema.safeParse({ decision: "approve", reason: "a".repeat(2001) }));
  });
});

describe("UC6 hiển thị giờ Việt Nam", () => {
  it("giá trị rỗng hoặc sai định dạng không làm vỡ form", () => {
    expect(toVietnamInputValue(null)).toBe("");
    expect(toVietnamInputValue("không-phải-ngày")).toBe("");
    expect(formatVietnamDateTime(undefined)).toBe("—");
  });
});

describe("UC7 cấu hình đăng ký — saveRegistrationSettingsSchema", () => {
  const base = { audienceRule: { type: "hiu_student" as const }, requiresApproval: true };
  const quota = (seats: number, label = "Khoa A") => ({ label, audienceRule: { type: "faculty" as const, faculty_id: FAC }, seats });

  it("tổng chỉ tiêu bằng đúng tổng số chỗ là hợp lệ (biên)", () => {
    const parsed = saveRegistrationSettingsSchema.parse({ ...base, capacity: 10, quotas: [quota(4), quota(6, "Khoa B")] });
    expect(parsed.quotas.map((q) => q.sortOrder)).toEqual([0, 0]);
  });

  it("tổng số chỗ: 1 và 100000 hợp lệ; 0, 100001 và số lẻ bị từ chối", () => {
    ok(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 1 }));
    ok(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 100000 }));
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 0 }));
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 100001 }));
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 2.5 }));
  });

  it("nhóm chỉ tiêu: tên tối thiểu 2 ký tự, ít nhất 1 chỗ, tối đa 50 nhóm", () => {
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 10, quotas: [quota(1, " A ")] }));
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 10, quotas: [quota(0)] }));
    ok(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 50, quotas: Array.from({ length: 50 }, (_, i) => quota(1, `Nhóm ${i}`)) }));
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, capacity: 51, quotas: Array.from({ length: 51 }, (_, i) => quota(1, `Nhóm ${i}`)) }));
  });

  it("hạn đóng đăng ký phải có múi giờ; hướng dẫn rỗng thành null", () => {
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, closesAt: "2026-11-01T08:00:00" }));
    const parsed = saveRegistrationSettingsSchema.parse({ ...base, closesAt: "2026-11-01T01:00:00Z", instructions: "   " });
    expect(parsed.instructions).toBeNull();
  });

  it("không nhận trường lạ (ví dụ trạng thái mở đăng ký) qua API lưu cấu hình", () => {
    bad(saveRegistrationSettingsSchema.safeParse({ ...base, status: "open" }));
  });

  it("đổi trạng thái chỉ nhận open/closed, không cho quay về draft", () => {
    ok(setRegistrationStatusSchema.safeParse({ status: "closed" }));
    bad(setRegistrationStatusSchema.safeParse({ status: "draft" }));
  });
});

describe("UC7 đăng ký và duyệt", () => {
  it("đăng ký không có câu trả lời mặc định là mảng rỗng", () => {
    expect(registerSchema.parse({}).answers).toEqual([]);
  });

  it("tối đa 200 câu trả lời; client không được gửi email người trả lời", () => {
    const answer = { question_id: "q1", answer_value: "x" };
    ok(registerSchema.safeParse({ answers: Array(200).fill(answer) }));
    bad(registerSchema.safeParse({ answers: Array(201).fill(answer) }));
    bad(registerSchema.safeParse({ respondent_email: "sv2020102@student.hiu.vn" }));
  });

  it("lý do từ chối: đúng 10 ký tự sau trim là đủ, khoảng trắng thuần bị coi là không có", () => {
    ok(decideRegistrationSchema.safeParse({ decision: "reject", reason: " 0123456789 " }));
    bad(decideRegistrationSchema.safeParse({ decision: "reject", reason: "          " }));
    expect(decideRegistrationSchema.parse({ decision: "approve", reason: "   " }).reason).toBeNull();
  });

  it("lỗi RPC nằm trong thông điệp dài vẫn được nhận diện; lỗi lạ không lộ chi tiết", () => {
    expect(registrationRpcError("P0001: REGISTRATION_FULL").code).toBe("REGISTRATION_FULL");
    const unknown = registrationRpcError("relation \"x\" does not exist");
    expect(unknown.status).toBe(500);
    expect(unknown.message).not.toContain("relation");
  });
});

describe("UC8 kế hoạch điểm danh — saveAttendancePlanSchema", () => {
  const s = (label: string, points = 0, isRequired = false) => ({ label, points, isRequired });

  it("điểm tối đa biên 0 và 100 hợp lệ; 101 và số âm bị từ chối", () => {
    ok(saveAttendancePlanSchema.safeParse({ maxPoints: 0, ruleType: "any_session", sessions: [s("Lượt 1")] }));
    ok(saveAttendancePlanSchema.safeParse({ maxPoints: 100, ruleType: "any_session", sessions: [s("Lượt 1")] }));
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: 101, ruleType: "any_session", sessions: [s("Lượt 1")] }));
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: -1, ruleType: "any_session", sessions: [s("Lượt 1")] }));
  });

  it("số lượt: 0 bị từ chối với thông báo rõ; 50 hợp lệ; 51 bị từ chối", () => {
    const empty = saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "any_session", sessions: [] });
    bad(empty);
    expect(empty.error?.issues[0].message).toBe("Cần ít nhất một lượt.");
    const many = (n: number) => Array.from({ length: n }, (_, i) => s(`Lượt ${i + 1}`));
    ok(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "any_session", sessions: many(50) }));
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "any_session", sessions: many(51) }));
  });

  it("cộng từng lượt: điểm lượt bằng đúng điểm tối đa là hợp lệ (biên)", () => {
    ok(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "sum_sessions", sessions: [s("Lượt 1", 3)] }));
  });

  it("theo bậc: bậc cần đúng bằng số lượt cấu hình là hợp lệ; không có bậc nào bị từ chối", () => {
    const sessions = [s("Lượt 1"), s("Lượt 2")];
    ok(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "tiers", tiers: [{ minSessions: 2, points: 3 }], sessions }));
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "tiers", tiers: [], sessions }));
  });

  it("theo bậc kèm lượt bắt buộc cần ít nhất một lượt bắt buộc", () => {
    const tiers = [{ minSessions: 1, points: 3 }];
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "tiers", tiers, tiersRequireRequired: true, sessions: [s("Lượt 1")] }));
    ok(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "tiers", tiers, tiersRequireRequired: true, sessions: [s("Lượt 1", 0, true)] }));
  });

  it("hành vi hiện tại: bậc gửi kèm vẫn bị kiểm tra dù quy tắc không phải 'theo bậc'", () => {
    bad(saveAttendancePlanSchema.safeParse({
      maxPoints: 3, ruleType: "any_session", tiers: [{ minSessions: 1, points: 5 }], sessions: [s("Lượt 1")],
    }));
  });

  it("tên lượt được trim trước khi kiểm độ dài; quy tắc lạ bị từ chối", () => {
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "any_session", sessions: [s("  A  ")] }));
    bad(saveAttendancePlanSchema.safeParse({ maxPoints: 3, ruleType: "best_effort", sessions: [s("Lượt 1")] }));
  });

  it("đổi trạng thái lượt chỉ nhận open/closed", () => {
    bad(setSessionStatusSchema.safeParse({ status: "draft" }));
    expect(setSessionStatusSchema.parse({ status: "closed" }).reason).toBeNull();
  });
});

describe("UC8 điểm danh QR — checkInSchema", () => {
  const sig = "0123456789abcdef".repeat(2);
  const token = (generation = "1", issued = "1792000000000", signature = sig) => `${SID}.${generation}.${issued}.${signature}`;

  it("nhận token hợp lệ với lần mở 6 chữ số (biên)", () => {
    ok(checkInSchema.safeParse({ sessionId: SID, token: token("999999") }));
  });

  it("từ chối lần mở 7 chữ số, chữ ký viết hoa, mốc thời gian quá ngắn", () => {
    bad(checkInSchema.safeParse({ sessionId: SID, token: token("1000000") }));
    bad(checkInSchema.safeParse({ sessionId: SID, token: token("1", "1792000000000", sig.toUpperCase()) }));
    bad(checkInSchema.safeParse({ sessionId: SID, token: token("1", "179200000") }));
  });

  it("sessionId phải là UUID và không nhận trường lạ", () => {
    bad(checkInSchema.safeParse({ sessionId: "lượt-1", token: token() }));
    bad(checkInSchema.safeParse({ sessionId: SID, token: token(), userId: SID }));
  });

  it("hành vi hiện tại: schema không đối chiếu sessionId với UUID trong token (DB trả WRONG_SESSION)", () => {
    ok(checkInSchema.safeParse({ sessionId: FAC, token: token() }));
    expect(attendanceRpcError("WRONG_SESSION").status).toBe(422);
  });
});

describe("UC8 ánh xạ lỗi RPC điểm danh", () => {
  it("AMEND_FORBIDDEN không bị nhận nhầm thành FORBIDDEN", () => {
    expect(attendanceRpcError("P0001: AMEND_FORBIDDEN")).toMatchObject({ status: 403, code: "AMEND_FORBIDDEN" });
    expect(attendanceRpcError("FORBIDDEN")).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("chưa đăng nhập hướng dẫn quét lại; lỗi lạ trả 500 chung", () => {
    expect(attendanceRpcError("UNAUTHENTICATED").message).toContain("quét lại");
    expect(attendanceRpcError("deadlock detected")).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
  });
});
