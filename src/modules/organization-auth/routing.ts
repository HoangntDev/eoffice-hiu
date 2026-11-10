// Phân luồng trang (R7): sinh viên không vào /admin, phiên tổ chức không vào trang sinh viên,
// phiên tổ chức chưa có cán bộ phải qua bước 2.
export type OrganizationUnitType = "school_union" | "office" | "faculty_union";

export type AdminViewer =
  | { kind: "guest" }
  | { kind: "student" }
  | { kind: "organization"; unitType: OrganizationUnitType; hasOfficer: boolean };

export type RouteDecision = { action: "next" } | { action: "redirect"; to: string };

export function adminRouteDecision(pathname: string, viewer: AdminViewer): RouteDecision {
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";
  const isOfficerLogin = pathname === "/admin/login/officer";
  const isStudentArea = pathname === "/programs" || pathname.startsWith("/programs/")
    || pathname === "/union-membership" || pathname.startsWith("/union-membership/");

  if (viewer.kind === "guest") {
    return isAdmin && !isAdminLogin && !isOfficerLogin
      ? { action: "redirect", to: "/admin/login" }
      : { action: "next" };
  }
  if (viewer.kind === "student") {
    return isAdmin ? { action: "redirect", to: "/admin/login" } : { action: "next" };
  }
  if (!viewer.hasOfficer) {
    return isOfficerLogin
      ? { action: "next" }
      : { action: "redirect", to: "/admin/login/officer" };
  }
  if (isStudentArea) return { action: "redirect", to: "/admin" };
  if (isAdminLogin || isOfficerLogin) return { action: "redirect", to: "/admin" };
  return { action: "next" };
}
