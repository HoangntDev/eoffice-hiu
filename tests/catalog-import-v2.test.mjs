import { describe, expect, it } from "vitest";
import {
  analyzeCatalogCsv,
  buildImportPlan,
  parseCsv,
  toCatalogRows,
} from "../scripts/import-academic-catalog.mjs";

describe("academic catalog CSV", () => {
  it("preserves Vietnamese, quoted commas, and leading zeroes", () => {
    const rows = toCatalogRows('Khoa chủ quản,Tên lớp học,Khóa học,Bậc đào tạo,Loại đào tạo,Ngành\n"Khoa Đ, Quốc tế",01ABC,DHCQK2026,Đại học,Chính quy,Ngành A\n');
    expect(rows[0]).toEqual({
      lineNumber: 2,
      facultyName: "Khoa Đ, Quốc tế",
      classCode: "01ABC",
      cohortCode: "DHCQK2026",
      educationLevel: "Đại học",
      trainingType: "Chính quy",
      programName: "Ngành A",
    });
  });

  it("rejects a changed header", () => {
    expect(() => toCatalogRows("Khoa chủ quản,Tên lớp học,Khóa học,Bậc đào tạo,Sai,Ngành\nA,C,2026,Đại học,Chính quy,B\n")).toThrow(/Header phải đúng/);
  });

  it("reports duplicate and missing values with CSV line numbers", () => {
    const csv = "Khoa chủ quản,Tên lớp học,Khóa học,Bậc đào tạo,Loại đào tạo,Ngành\nA,C,2026,Đại học,Chính quy,B\nA,C,2026,Đại học,Chính quy,B\nA,D,,Đại học,Chính quy,B\n";
    const result = analyzeCatalogCsv(csv);
    expect(result).toMatchObject({ totalRows: 3, validRows: 0, invalidRows: 3 });
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DUPLICATE_CLASS_CODE", lineNumbers: [2, 3] }),
      expect.objectContaining({ code: "MISSING_REQUIRED_VALUE", lineNumber: 4, field: "Khóa học" }),
    ]));
  });

  it("rejects unclosed quotes", () => {
    expect(() => parseCsv('A,"B')).toThrow(/chưa đóng/);
  });

  it("plans inserts, updates, and idempotent reruns without guessing relationships", () => {
    const rows = toCatalogRows("Khoa chủ quản,Tên lớp học,Khóa học,Bậc đào tạo,Loại đào tạo,Ngành\nKhoa A,00A,DHCQK2026,Đại học,Chính quy,Ngành A\nKhoa B,00B,DHCQK2025,Đại học,Chính quy,Ngành B\n");
    const existing = {
      faculties: [{ id: "f-a", current_name: "Khoa A" }],
      programs: [{ id: "p-a", current_name: "Ngành A", current_faculty_id: "f-a" }],
      cohorts: [{ id: "c-26", code: "DHCQK2026" }],
      classes: [{
        id: "l-a",
        current_code: "00A",
        current_program_id: "p-a",
        current_cohort_id: "c-26",
        education_level: "Đại học",
        training_type: "Vừa làm vừa học",
      }],
    };
    expect(buildImportPlan(rows, existing)).toMatchObject({
      faculties: { insert: 1, update: 0 },
      programs: { insert: 1, update: 0 },
      cohorts: { insert: 1, update: 0 },
      classes: { insert: 1, update: 1 },
      conflicts: [],
    });

    existing.faculties.push({ id: "f-b", current_name: "Khoa B" });
    existing.programs.push({ id: "p-b", current_name: "Ngành B", current_faculty_id: "f-b" });
    existing.cohorts.push({ id: "c-25", code: "DHCQK2025" });
    existing.classes[0].training_type = "Chính quy";
    existing.classes.push({
      id: "l-b",
      current_code: "00B",
      current_program_id: "p-b",
      current_cohort_id: "c-25",
      education_level: "Đại học",
      training_type: "Chính quy",
    });
    expect(buildImportPlan(rows, existing)).toMatchObject({
      faculties: { insert: 0, update: 0 },
      programs: { insert: 0, update: 0 },
      cohorts: { insert: 0, update: 0 },
      classes: { insert: 0, update: 0 },
      conflicts: [],
    });
  });
});
