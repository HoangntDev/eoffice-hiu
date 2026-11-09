// Thanh trên cùng (R2) và dropdown đơn vị nhóm theo cấp ở bước 1.
import type { OrganizationUnitType } from "./routing";

export type HeaderInput = { unitName: string; officerName: string | null; officerCode: string };

export type LoginUnit = {
  id: string;
  name: string;
  unitType: OrganizationUnitType | "school_committee" | "class_union";
  isActive: boolean;
  hasAccount: boolean;
};

export type LoginUnitGroup = { level: OrganizationUnitType; label: string; units: { id: string; name: string }[] };

export function organizationHeader(input: HeaderInput): string {
  const officer = input.officerName?.trim() || input.officerCode;
  return `${input.unitName} · Cán bộ: ${officer}`;
}

export function groupLoginUnits(units: LoginUnit[]): LoginUnitGroup[] {
  const labels: Record<OrganizationUnitType, string> = {
    school_union: "Đoàn Trường",
    office: "Văn phòng Đoàn – Hội",
    faculty_union: "Đoàn Khoa",
  };
  const levels: OrganizationUnitType[] = ["school_union", "office", "faculty_union"];
  return levels.flatMap((level) => {
    const eligible = units
      .filter((unit) => unit.unitType === level && unit.isActive && unit.hasAccount)
      .map(({ id, name }) => ({ id, name }));
    return eligible.length ? [{ level, label: labels[level], units: eligible }] : [];
  });
}
