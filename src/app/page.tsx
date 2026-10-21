import Link from "next/link";
import { MyTasks } from "@/components/my-tasks";
import { getViewer } from "@/lib/auth/viewer";

const features = [
  {
    href: "/register",
    title: "Tài khoản sinh viên",
    desc: "Đăng ký bằng MSSV 10 số và email sinh viên HIU. Đăng nhập bằng PIN 6 chữ số.",
  },
  {
    href: "/onboarding/profile",
    title: "Hồ sơ Đoàn viên",
    desc: "Khai báo thông tin, theo dõi trạng thái công nhận và lịch sử xét duyệt.",
  },
  {
    href: "/forms",
    title: "Biểu mẫu sự kiện",
    desc: "Tạo, phát hành biểu mẫu đăng ký; sinh viên nộp và quản lý kết quả CSV.",
  },
  {
    href: "/organization",
    title: "Quản lý tổ chức",
    desc: "Quản lý danh mục học vụ, cơ cấu Đoàn–Hội và phân công quyền.",
  },
];

const guides = [
  "Tạo tài khoản bằng MSSV và email @student.hiu.vn",
  "Đặt PIN 6 số",
  "Đăng nhập và dùng chức năng",
];

export default async function Home() {
  const viewer = await getViewer();
  if (viewer) {
    return (
      <main className="portal-main">
        <div className="portal-banner portal-banner--compact">
          <div className="portal-banner-inner">
            <p className="portal-banner-eyebrow">Văn phòng điện tử Đoàn – Hội HIU</p>
            <h1 className="portal-banner-title">Xin chào{viewer.fullName ? `, ${viewer.fullName}` : ""}</h1>
            {!viewer.fullName && (
              <p className="portal-banner-sub">Hãy <Link href="/onboarding/profile">hoàn thiện hồ sơ sinh viên</Link> để dùng đầy đủ chức năng.</p>
            )}
          </div>
        </div>
        <div className="portal-body portal-body--single">
          <div className="portal-content">
            <MyTasks viewer={viewer} />
          </div>
        </div>
      </main>
    );
  }

  // Chưa đăng nhập: giữ trang giới thiệu.
  return (
    <main className="portal-main">
      <div className="portal-banner">
        <div className="portal-banner-inner">
          <p className="portal-banner-eyebrow">Cổng nghiệp vụ chính thức</p>
          <h1 className="portal-banner-title">Văn phòng điện tử Đoàn – Hội HIU</h1>
          <p className="portal-banner-sub">
            Hệ thống quản lý hồ sơ Đoàn viên, biểu mẫu sự kiện và cơ cấu tổ chức
            dành cho sinh viên và cán bộ Đoàn Trường HIU.
          </p>
          {/* Đăng nhập / Tạo tài khoản đã có ở thanh đầu trang, không lặp lại ở đây. */}
          <div className="portal-banner-actions">
            <Link className="portal-btn-ghost" href="/forms">Xem biểu mẫu đang mở</Link>
          </div>
        </div>
      </div>

      <div className="portal-body portal-body--single">
        <div className="portal-content">
          <section className="portal-section">
            <h2 className="portal-section-title">Giới thiệu chức năng</h2>
            <div className="portal-card-grid">
              {features.map((f) => (
                <Link key={f.href} href={f.href} className="portal-feature-card">
                  <strong>{f.title}</strong>
                  <p>{f.desc}</p>
                </Link>
              ))}
            </div>
            <h3 className="guide-heading">Bắt đầu trong 3 bước</h3>
            <ol className="guide-list guide-list--inline">
              {guides.map((step, i) => (
                <li key={i}>
                  <span className="guide-num">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

        </div>
      </div>
    </main>
  );
}
