import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";

const statusLabel: Record<string, string> = {
  active: "Đang hoạt động",
  pending_email_verification: "Chờ xác minh email",
  suspended: "Tạm khóa",
};

const sections = [
  { href: "/onboarding/profile", title: "Hồ sơ sinh viên", desc: "Họ tên, ngày sinh, Lớp và thông tin liên hệ." },
  { href: "/union-membership", title: "Hồ sơ Đoàn viên", desc: "Khai báo Đoàn viên, theo dõi trạng thái công nhận." },
  { href: "/account/security", title: "Đổi PIN", desc: "Đổi mã PIN 6 chữ số dùng để đăng nhập." },
];

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <main className="page narrow">
      <div className="page-header"><div><p className="eyebrow">Tài khoản cá nhân</p><h1>Tài khoản</h1></div></div>
      <section className="panel">
        <dl className="account-facts">
          <dt>MSSV</dt><dd>{viewer.studentCode ?? "—"}</dd>
          <dt>Email sinh viên</dt><dd>{viewer.email ?? "—"}</dd>
          <dt>Trạng thái</dt><dd>{statusLabel[viewer.accountStatus ?? ""] ?? viewer.accountStatus ?? "—"}</dd>
        </dl>
      </section>
      <div className="account-links">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="card">
            <strong>{section.title}</strong>
            <p>{section.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
