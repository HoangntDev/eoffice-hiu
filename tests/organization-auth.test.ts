// CR-01-TaiKhoanToChuc (#37): test RED cho phần TypeScript. Cho trước ↔ Arrange, Khi ↔ Act, Thì ↔ Assert.
// outcome() bắt lỗi để test thất bại ở assertion (nhận NOT_IMPLEMENTED thay vì giá trị mong đợi).
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { groupLoginUnits, organizationHeader, type LoginUnit } from "@/modules/organization-auth/display";
import { adminMenuFor } from "@/modules/organization-auth/navigation";
import {
  organizationLoginFailure,
  orgLoginAttemptPolicy,
  pendingLoginCookieOptions,
  type OrganizationLoginFailureReason,
} from "@/modules/organization-auth/policy";
import { adminRouteDecision, type AdminViewer } from "@/modules/organization-auth/routing";
import { parseOfficerLoginStep2, parseOrganizationLoginStep1 } from "@/modules/organization-auth/schemas";

type Outcome<T> = { value: T } | { error: string; errorType: string };
function outcome<T>(run: () => T): Outcome<T> {
  try {
    return { value: run() };
  } catch (error) {
    return { error: (error as Error).message, errorType: (error as Error).constructor.name };
  }
}

const ORG_ID = "00000000-0000-4000-8000-000000000002";
const faculty: AdminViewer = { kind: "organization", unitType: "faculty_union", hasOfficer: true };

describe("AC1: đăng nhập hai bước và thanh trên cùng", () => {
  it("bước 1 nhận đơn vị + PIN tổ chức 6 số", () => {
    expect(outcome(() => parseOrganizationLoginStep1({ organizationId: ORG_ID, organizationPin: "246810" })))
      .toEqual({ value: { organizationId: ORG_ID, organizationPin: "246810" } });
  });

  it("bước 1 từ chối PIN tổ chức không đủ 6 số", () => {
    const result = outcome(() => parseOrganizationLoginStep1({ organizationId: ORG_ID, organizationPin: "24681" }));
    expect(result).toMatchObject({ errorType: ZodError.name });
  });

  it("bước 2 nhận MSSV 10 số + PIN cá nhân 6 số", () => {
    expect(outcome(() => parseOfficerLoginStep2({ studentCode: "2201110202", pin: "123456" })))
      .toEqual({ value: { studentCode: "2201110202", pin: "123456" } });
  });

  it("bước 2 không nhận thêm PIN tổ chức (đã xác thực ở bước 1)", () => {
    const result = outcome(() => parseOfficerLoginStep2({ studentCode: "2201110202", pin: "123456", organizationPin: "246810" }));
    expect(result).toMatchObject({ errorType: ZodError.name });
  });

  it("thanh trên cùng hiện đơn vị và cán bộ đang thao tác", () => {
    const header = outcome(() => organizationHeader({ unitName: "Văn phòng Đoàn – Hội", officerName: "Lê Thị Mai", officerCode: "2201110202" }));
    expect(header).toEqual({ value: expect.stringContaining("Văn phòng Đoàn – Hội") });
    expect(header).toEqual({ value: expect.stringContaining("Lê Thị Mai") });
  });

  it("cán bộ chưa có họ tên thì thanh trên cùng hiện MSSV", () => {
    expect(outcome(() => organizationHeader({ unitName: "Đoàn Khoa CNKT", officerName: null, officerCode: "2201110201" })))
      .toEqual({ value: expect.stringContaining("2201110201") });
  });
});

describe("AC2: dropdown đơn vị nhóm theo cấp", () => {
  const units: LoginUnit[] = [
    { id: "f1", name: "Đoàn Khoa CNKT", unitType: "faculty_union", isActive: true, hasAccount: true },
    { id: "f2", name: "Đoàn Khoa Dược", unitType: "faculty_union", isActive: true, hasAccount: false },
    { id: "f3", name: "Đoàn Khoa cũ", unitType: "faculty_union", isActive: false, hasAccount: true },
    { id: "o", name: "Văn phòng Đoàn – Hội", unitType: "office", isActive: true, hasAccount: true },
    { id: "s", name: "Đoàn Trường", unitType: "school_union", isActive: true, hasAccount: true },
    { id: "b", name: "Ban Tổ chức – Kiểm tra", unitType: "school_committee", isActive: true, hasAccount: true },
    { id: "c", name: "Chi đoàn 22DTH1", unitType: "class_union", isActive: true, hasAccount: true },
  ];

  it("chỉ có đơn vị đang hoạt động đã có tài khoản, theo thứ tự Đoàn Trường → Văn phòng → Đoàn Khoa", () => {
    const result = outcome(() => groupLoginUnits(units));
    expect(result).toEqual({
      value: [
        { level: "school_union", label: expect.any(String), units: [{ id: "s", name: "Đoàn Trường" }] },
        { level: "office", label: expect.any(String), units: [{ id: "o", name: "Văn phòng Đoàn – Hội" }] },
        { level: "faculty_union", label: expect.any(String), units: [{ id: "f1", name: "Đoàn Khoa CNKT" }] },
      ],
    });
  });
});

describe("AC4: mỗi bước sai đều trả một thông báo lỗi chung", () => {
  const reasons: OrganizationLoginFailureReason[] = [
    "wrong_organization_pin", "organization_locked", "unknown_organization", "wrong_student_code",
    "wrong_personal_pin", "personal_account_inactive", "not_a_member", "pending_login_expired",
  ];

  it("mọi lý do cho cùng status, mã và câu thông báo", () => {
    const results = reasons.map((reason) => outcome(() => organizationLoginFailure(reason)));
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(results[0]).toEqual({ value: { status: 401, code: "INVALID_CREDENTIALS", message: expect.any(String) } });
  });

  it("thông báo không nói bước nào hay thông tin nào sai", () => {
    const result = outcome(() => organizationLoginFailure("not_a_member"));
    expect(result).toHaveProperty("value.message");
    expect(JSON.stringify(result)).not.toMatch(/thành viên|MSSV không|PIN tổ chức sai|bị khóa/i);
  });
});

describe("AC5: giới hạn thử PIN tổ chức", () => {
  it("5 lần sai trong 15 phút, tính theo đơn vị + IP", () => {
    expect(outcome(() => orgLoginAttemptPolicy()))
      .toEqual({ value: { action: "org_login", maxFailures: 5, windowMinutes: 15, scope: ["organization", "ip"] } });
  });
});

describe("AC9 (R7): phân luồng trang và menu theo loại đơn vị", () => {
  it.each([
    ["khách vào /admin", "/admin", { kind: "guest" }, { action: "redirect", to: "/admin/login" }],
    ["khách mở trang đăng nhập tổ chức", "/admin/login", { kind: "guest" }, { action: "next" }],
    ["sinh viên vào /admin/programs", "/admin/programs", { kind: "student" }, { action: "redirect", to: "/admin/login" }],
    ["phiên tổ chức vào trang sinh viên /programs", "/programs", faculty, { action: "redirect", to: "/admin" }],
    ["phiên tổ chức vào /union-membership", "/union-membership", faculty, { action: "redirect", to: "/admin" }],
    ["phiên tổ chức vào /admin/programs", "/admin/programs", faculty, { action: "next" }],
    ["sinh viên vào /programs (không đổi, R9)", "/programs", { kind: "student" }, { action: "next" }],
  ] as [string, string, AdminViewer, unknown][])("%s", (_name, pathname, viewer, expected) => {
    expect(outcome(() => adminRouteDecision(pathname, viewer))).toEqual({ value: expected });
  });

  it("Đoàn Khoa thấy kế hoạch chương trình, không thấy duyệt và tài khoản", () => {
    const menu = outcome(() => adminMenuFor("faculty_union"));
    expect(menu).toEqual({ value: expect.arrayContaining(["/admin/programs"]) });
    expect(menu).not.toEqual({ value: expect.arrayContaining(["/admin/reviews"]) });
    expect(menu).not.toEqual({ value: expect.arrayContaining(["/admin/accounts"]) });
  });

  it("Văn phòng thấy mục duyệt, không thấy tài khoản tổ chức", () => {
    const menu = outcome(() => adminMenuFor("office"));
    expect(menu).toEqual({ value: expect.arrayContaining(["/admin/reviews"]) });
    expect(menu).not.toEqual({ value: expect.arrayContaining(["/admin/accounts"]) });
  });

  it("Đoàn Trường thấy cơ cấu và tài khoản tổ chức", () => {
    expect(outcome(() => adminMenuFor("school_union")))
      .toEqual({ value: expect.arrayContaining(["/admin/organization", "/admin/accounts"]) });
  });
});

describe("AC12: phiên tạm của bước 1", () => {
  it("cookie phiên tạm httpOnly, SameSite=Strict, hết hạn sau 5 phút", () => {
    expect(outcome(() => pendingLoginCookieOptions()))
      .toEqual({ value: { httpOnly: true, sameSite: "strict", path: "/", maxAge: 300 } });
  });
});

describe("AC13, AC14: đổi cán bộ và phiên chưa có cán bộ", () => {
  const noOfficer: AdminViewer = { kind: "organization", unitType: "office", hasOfficer: false };

  it("phiên tổ chức chưa có cán bộ vào /admin thì về bước 2", () => {
    expect(outcome(() => adminRouteDecision("/admin", noOfficer)))
      .toEqual({ value: { action: "redirect", to: "/admin/login/officer" } });
  });

  it("phiên tổ chức chưa có cán bộ không vào được trang nghiệp vụ", () => {
    expect(outcome(() => adminRouteDecision("/admin/reviews", noOfficer)))
      .toEqual({ value: { action: "redirect", to: "/admin/login/officer" } });
  });

  it("sau khi bấm Đổi cán bộ (phiên tạm, chưa đăng nhập) vào được trang bước 2", () => {
    expect(outcome(() => adminRouteDecision("/admin/login/officer", { kind: "guest" }))).toEqual({ value: { action: "next" } });
  });
});
