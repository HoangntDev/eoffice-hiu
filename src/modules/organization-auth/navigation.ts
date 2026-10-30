// Menu quản trị theo loại đơn vị (R7).
import { NotImplementedError } from "./errors";
import type { OrganizationUnitType } from "./routing";

export function adminMenuFor(unitType: OrganizationUnitType): string[] {
  void unitType;
  throw new NotImplementedError("adminMenuFor");
}
