// Menu quản trị theo loại đơn vị (R7).
import type { OrganizationUnitType } from "./routing";

export function adminMenuFor(unitType: OrganizationUnitType, paymentEnabled = false): string[] {
  if (unitType === "school_union") {
    return ["/admin", "/admin/organization", "/admin/accounts", "/admin/forms", "/admin/settings"];
  }
  if (unitType === "office") {
    return ["/admin", "/admin/reviews", "/admin/membership", "/admin/settings"];
  }
  return ["/admin", "/admin/programs", ...(paymentEnabled ? ["/admin/payments"] : []), "/admin/forms", "/admin/settings"];
}
