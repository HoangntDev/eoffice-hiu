import { AccessDenied } from "@/components/access-denied";
import { OrganizationConsole } from "@/components/organization-console";
import { getViewer } from "@/lib/auth/viewer";

export default async function OrganizationPage() {
  const viewer = await getViewer();
  if (!viewer?.access.organization) {
    return <AccessDenied title="Danh mục và phân quyền" reason="Trang này dành cho Đoàn Trường, BCH Đoàn Khoa và Trưởng Ban. Tài khoản của bạn chưa được cấp vai trò quản lý tổ chức." />;
  }
  return <main className="page"><div className="page-header"><div><p className="eyebrow">Phạm vi tổ chức thật</p><h1>Danh mục và phân quyền</h1><p className="lead">Đoàn Trường quản lý toàn cục; Đoàn Khoa chỉ quản lý Lớp thuộc Khoa mình; Ban chỉ cấp CTV trong Ban.</p></div></div><OrganizationConsole/></main>;
}
