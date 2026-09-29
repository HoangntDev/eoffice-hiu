import { describe, expect, it } from "vitest";
import { parseCsv, toCatalogRows } from "../scripts/import-academic-catalog.mjs";

describe("academic catalog CSV", () => {
  it("preserves Vietnamese, quoted commas, and leading zeroes", () => {
    const rows = toCatalogRows('STT,Khoa,Ngành,Lớp,Khóa,Số hiệu,Thứ tự khoa\n1,"Khoa Đ, Quốc tế",Ngành A,01ABC,2026,001,02\n');
    expect(rows[0]).toEqual({
      STT: "1", Khoa: "Khoa Đ, Quốc tế", Ngành: "Ngành A", Lớp: "01ABC", Khóa: "2026", "Số hiệu": "001", "Thứ tự khoa": "02",
    });
  });

  it("rejects a changed header", () => {
    expect(() => toCatalogRows("STT,Khoa,Ngành,Lớp,Khóa,Sai,Thứ tự khoa\n1,A,B,C,2026,1,1\n")).toThrow(/Header phải đúng/);
  });

  it("rejects duplicate class codes before writing", () => {
    const csv = "STT,Khoa,Ngành,Lớp,Khóa,Số hiệu,Thứ tự khoa\n1,A,B,C,2026,1,1\n2,A,B,C,2026,2,1\n";
    expect(() => toCatalogRows(csv)).toThrow(/Lớp trùng/);
  });

  it("rejects unclosed quotes", () => {
    expect(() => parseCsv('A,"B')).toThrow(/chưa đóng/);
  });
});
