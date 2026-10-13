import { describe, expect, it } from "vitest";
import { acceptanceRpcError } from "@/modules/program-acceptance/errors";
import { buildAcceptanceCsv, type AcceptanceAttendanceRow } from "@/modules/program-acceptance/export";
import { checkAcceptanceFile } from "@/modules/program-acceptance/files";
import { academicTermSchema, resolveComplaintSchema, reviewAcceptanceSchema } from "@/modules/program-acceptance/schemas";

const pdf = new TextEncoder().encode("%PDF-1.7 xxxx");
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("UC9 tệp hồ sơ", () => {
  it("Đơn đề nghị chỉ nhận PDF thật", () => {
    expect(checkAcceptanceFile("proposal", { name: "don.pdf", type: "application/pdf", size: 100 }, pdf).ok).toBe(true);
    expect(checkAcceptanceFile("proposal", { name: "anh.jpg", type: "image/jpeg", size: 100 }, jpg).ok).toBe(false);
    // Đổi đuôi .pdf cho ảnh: chữ ký tệp không khớp.
    expect(checkAcceptanceFile("report", { name: "gia.pdf", type: "application/pdf", size: 100 }, jpg).ok).toBe(false);
  });
  it("Minh chứng nhận ảnh, chặn tệp quá 5MB", () => {
    expect(checkAcceptanceFile("evidence", { name: "anh.JPG", type: "image/jpeg", size: 100 }, jpg))
      .toMatchObject({ ok: true, ext: "jpg", contentType: "image/jpeg" });
    expect(checkAcceptanceFile("evidence", { name: "anh.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 }, jpg))
      .toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });
});

describe("UC9 schema và lỗi", () => {
  it("Yêu cầu bổ sung/từ chối cần lý do; nghiệm thu thì không", () => {
    expect(reviewAcceptanceSchema.safeParse({ decision: "accept" }).success).toBe(true);
    expect(reviewAcceptanceSchema.safeParse({ decision: "request_changes", reason: "thiếu" }).success).toBe(false);
    expect(resolveComplaintSchema.safeParse({ decision: "accept", reason: "ngắn" }).success).toBe(false);
  });
  it("Học kỳ: năm học liên tiếp, ngày kết thúc sau ngày bắt đầu", () => {
    const base = { academicYear: "2026-2027", termCode: "HK1", name: "Học kỳ 1", startsOn: "2026-09-01", endsOn: "2027-01-15" };
    expect(academicTermSchema.safeParse(base).success).toBe(true);
    expect(academicTermSchema.safeParse({ ...base, academicYear: "2026-2028" }).success).toBe(false);
    expect(academicTermSchema.safeParse({ ...base, endsOn: "2026-08-01" }).success).toBe(false);
  });
  it("Ánh xạ mã lỗi DB sang thông báo", () => {
    expect(acceptanceRpcError("MISSING_DOCUMENTS:report,evidence").message).toBe("Hồ sơ còn thiếu: Báo cáo kết quả, Ảnh minh chứng.");
    expect(acceptanceRpcError("SELF_REVIEW_FORBIDDEN").status).toBe(403);
    expect(acceptanceRpcError("TERM_NOT_CONFIGURED").status).toBe(409);
  });
});

describe("UC9 bảng dữ liệu đề nghị", () => {
  it("CSV ghi rõ điểm dự kiến, không có cột uy tín, chặn công thức", () => {
    const row: AcceptanceAttendanceRow = {
      registration_id: "r", user_id: "u", student_code: "2026990005", full_name: "=HYPERLINK(1)", class_code: "K1",
      faculty_name: "Khoa A", attended_count: 1,
      attended_sessions: [{ session_id: "s", label: "Đầu giờ", supplementary: true, source: "complaint" }],
      participation: "participated", expected_points: 0,
    };
    const csv = buildAcceptanceCsv([row]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("chưa được Thư ký Khoa cấp");
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("Đầu giờ (bổ sung qua khiếu nại)");
    expect(csv.toLowerCase()).not.toContain("uy tín");
  });
});
