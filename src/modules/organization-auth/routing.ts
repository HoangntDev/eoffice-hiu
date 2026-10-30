// Phân luồng trang (R7): sinh viên không vào /admin, phiên tổ chức không vào trang sinh viên,
// phiên tổ chức chưa có cán bộ phải qua bước 2.
import { NotImplementedError } from "./errors";

export type OrganizationUnitType = "school_union" | "office" | "faculty_union";

export type AdminViewer =
  | { kind: "guest" }
  | { kind: "student" }
  | { kind: "organization"; unitType: OrganizationUnitType; hasOfficer: boolean };

export type RouteDecision = { action: "next" } | { action: "redirect"; to: string };

export function adminRouteDecision(pathname: string, viewer: AdminViewer): RouteDecision {
  void pathname;
  void viewer;
  throw new NotImplementedError("adminRouteDecision");
}
