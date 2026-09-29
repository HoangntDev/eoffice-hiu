import Link from "next/link";

export default function Home() {
  return (
    <main className="page landing">
      <section className="hero">
        <p className="eyebrow">Nền tảng nghiệp vụ Đoàn – Hội</p>
        <h1>Mỗi hồ sơ có nguồn gốc, phạm vi và lịch sử rõ ràng.</h1>
        <p className="lead">
          Prompt 01 triển khai nền tảng tài khoản, danh mục học vụ có ngày hiệu lực và quy trình tiếp nhận – công nhận hồ sơ Đoàn viên.
          Đây chưa phải toàn bộ đồ án; thư viện mẫu và biểu mẫu động thuộc Prompt 02.
        </p>
        <div className="actions">
          <Link className="button primary" href="/register">Tạo tài khoản sinh viên</Link>
          <Link className="button secondary" href="/login">Đăng nhập bằng MSSV</Link>
        </div>
      </section>
      <section className="feature-grid" aria-label="Chức năng Prompt 01">
        <article className="card"><span>01</span><h2>Hồ sơ sinh viên</h2><p>Chỉ thu thập dữ liệu cơ bản sau khi Gmail được xác minh.</p></article>
        <article className="card"><span>02</span><h2>Cơ cấu học vụ</h2><p>Khoa, Ngành, Lớp có UUID bất biến và lịch sử theo ngày hiệu lực.</p></article>
        <article className="card"><span>03</span><h2>Công nhận Đoàn viên</h2><p>CTV đề xuất; Văn phòng duyệt sau khi tiếp nhận Sổ Đoàn.</p></article>
      </section>
    </main>
  );
}
