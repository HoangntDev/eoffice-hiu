// Thanh trên cùng (R2) và dropdown đơn vị nhóm theo cấp ở bước 1.
import { NotImplementedError } from "./errors";
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
  void input;
  throw new NotImplementedError("organizationHeader");
}

export function groupLoginUnits(units: LoginUnit[]): LoginUnitGroup[] {
  void units;
  throw new NotImplementedError("groupLoginUnits");
}
