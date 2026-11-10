import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OrganizationSessionActions } from "@/components/organization-session-actions";
import { getOrganizationViewer, organizationAccountsEnabled } from "@/lib/auth/organization-viewer";
import { organizationHeader } from "@/modules/organization-auth/display";
import { adminMenuFor } from "@/modules/organization-auth/navigation";

const labels: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/programs": "Kế hoạch chương trình",
  "/admin/reviews": "Duyệt kế hoạch",
  "/admin/organization": "Cơ cấu tổ chức",
  "/admin/accounts": "Tài khoản tổ chức",
  "/admin/forms": "Biểu mẫu",
  "/admin/membership": "Hồ sơ Đoàn viên",
  "/admin/settings": "Đổi PIN",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!await organizationAccountsEnabled()) redirect("/login");
  const viewer = await getOrganizationViewer();
  if (!viewer) redirect("/admin/login");
  if (!viewer.officerUserId || !viewer.officerCode) redirect("/admin/login/officer");
  const menu = adminMenuFor(viewer.unitType);
  return <>
    <div className="admin-context">
      <strong>{organizationHeader({ unitName: viewer.unitName, officerName: viewer.officerName, officerCode: viewer.officerCode })}</strong>
      <OrganizationSessionActions />
    </div>
    <nav className="admin-nav" aria-label="Điều hướng quản trị">
      {menu.map((href) => <Link key={href} href={href}>{labels[href] ?? href}</Link>)}
    </nav>
    {children}
  </>;
}
