import Link from "next/link";
import { getOrganizationViewer } from "@/lib/auth/organization-viewer";
import { adminMenuFor } from "@/modules/organization-auth/navigation";

export default async function AdminPage() {
  const viewer = await getOrganizationViewer();
  const links = viewer ? adminMenuFor(viewer.unitType).filter((href) => href !== "/admin") : [];
  return <main className="page"><div className="page-header"><div><p className="eyebrow">Khu vực quản trị</p><h1>{viewer?.unitName}</h1><p className="lead">Chức năng hiển thị theo đúng loại đơn vị và được kiểm quyền lại tại database.</p></div></div>
    <section className="portal-card-grid">{links.map((href) => <Link className="portal-feature-card" key={href} href={href}><strong>{href.split("/").at(-1)}</strong><p>Mở chức năng quản trị.</p></Link>)}</section>
  </main>;
}
