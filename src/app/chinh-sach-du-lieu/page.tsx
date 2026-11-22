import Link from "next/link";

export const metadata = { title: "Chính sách dữ liệu cá nhân | HIU Youth E-Office" };

export default function DataPolicyPage() {
  return <main className="page"><article className="panel">
    <h1>Chính sách dữ liệu cá nhân</h1>
    <h2>Khi bạn tạo tài khoản</h2>
    <p>Văn phòng điện tử Đoàn – Hội HIU sử dụng mã số sinh viên và email sinh viên HIU để xác minh tài khoản. Hệ thống ghi thời điểm bạn đồng ý xử lý dữ liệu khi gửi yêu cầu đăng ký.</p>
    <h2>Khi bạn khai hồ sơ Đoàn viên</h2>
    <p>Hồ sơ yêu cầu số CCCD và thông tin tôn giáo để xét hồ sơ Đoàn viên. Bạn có thể xem lại thông tin đã khai. Cán bộ có quyền xét hồ sơ chỉ được mở thông tin định danh trong phạm vi phụ trách. Hệ thống ghi nhận từng lần cán bộ mở thông tin này.</p>
    <p>Các trường CCCD và tôn giáo được loại khỏi tệp CSV và nhật ký ứng dụng.</p>
    <Link href="/register">Quay lại đăng ký</Link>
  </article></main>;
}
