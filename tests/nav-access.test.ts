import { describe, expect, it } from "vitest";
import { navAccess } from "@/lib/auth/roles";

describe("menu theo vai trò", () => {
  it("sinh viên không có vai trò thì không thấy Cơ cấu và Xử lý hồ sơ", () => {
    expect(navAccess([])).toEqual({ organization: false, membershipReview: false });
  });

  it("Đoàn Trường thấy cả hai", () => {
    expect(navAccess(["school_admin"])).toEqual({ organization: true, membershipReview: true });
  });

  it("Đoàn Khoa và Trưởng Ban chỉ thấy Cơ cấu", () => {
    for (const role of ["faculty_manager", "faculty_executive", "committee_manager"]) {
      expect(navAccess([role])).toEqual({ organization: true, membershipReview: false });
    }
  });

  it("Văn phòng và CTV chỉ thấy Xử lý hồ sơ", () => {
    for (const role of ["office", "collaborator"]) {
      expect(navAccess([role])).toEqual({ organization: false, membershipReview: true });
    }
  });

  it("vai trò lạ không mở thêm menu", () => {
    expect(navAccess(["student", "guest"])).toEqual({ organization: false, membershipReview: false });
  });
});
