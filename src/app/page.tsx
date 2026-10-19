import Link from "next/link";
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
  "Đăng ký tài khoản bằng MSSV 10 số (bắt đầu bằng 21, 22, 23…)",
  "Xác minh qua email sinh viên HIU (@student.hiu.vn)",
  "Thiết lập PIN 6 chữ số để đăng nhập",
  "Khai báo hồ sơ Đoàn viên và theo dõi xét duyệt",
  "Điền biểu mẫu sự kiện do Đoàn – Hội phát hành",
];

export default async function Home() {
  const viewer = await getViewer();
  return (
    <main className="portal-main">
      {/* Banner */}
      <div className="portal-banner">
        <div className="portal-banner-inner">
          <p className="portal-banner-eyebrow">Cổng nghiệp vụ chính thức</p>
          <h1 className="portal-banner-title">Văn phòng điện tử Đoàn – Hội HIU</h1>
          <p className="portal-banner-sub">
            Hệ thống quản lý hồ sơ Đoàn viên, biểu mẫu sự kiện và cơ cấu tổ chức
            dành cho sinh viên và cán bộ Đoàn Trường HIU.
          </p>
          {!viewer && (
            <div className="portal-banner-actions">
              <Link className="portal-btn-primary" href="/login">Đăng nhập hệ thống</Link>
              <Link className="portal-btn-ghost" href="/register">Tạo tài khoản</Link>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="portal-body portal-body--single">
        {/* Main content */}
        <div className="portal-content">
          {/* Feature cards — chỉ giới thiệu cho người chưa đăng nhập; đã đăng nhập thì dùng menu */}
          {!viewer && <section className="portal-section">
            <h2 className="portal-section-title">Giới thiệu chức năng</h2>
            <div className="portal-card-grid">
              {features.map((f) => (
                <Link key={f.href} href={f.href} className="portal-feature-card">
                  <strong>{f.title}</strong>
                  <p>{f.desc}</p>
                </Link>
              ))}
            </div>
          </section>}

          {/* Guide */}
          <section className="portal-section">
            <h2 className="portal-section-title">Hướng dẫn sử dụng</h2>
            <div className="panel">
              <ol className="guide-list">
                {guides.map((step, i) => (
                  <li key={i}>
                    <span className="guide-num">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
