// Menu quản trị theo loại đơn vị (R7).
import type { OrganizationUnitType } from "./routing";

export function adminMenuFor(unitType: OrganizationUnitType): string[] {
  if (unitType === "school_union") {
    return ["/admin", "/admin/organization", "/admin/accounts", "/admin/forms"];
  }
  if (unitType === "office") {
    return ["/admin", "/admin/reviews", "/admin/membership"];
  }
  return ["/admin", "/admin/programs", "/admin/forms"];
}
