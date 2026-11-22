import Link from "next/link";
import { DATA_POLICY_CONTACT_EMAIL } from "@/lib/data-policy";

export const metadata = { title: "Chính sách xử lý dữ liệu cá nhân | HIU Youth E-Office" };

export default function DataPolicyPage() {
  const contact = <a href={`mailto:${DATA_POLICY_CONTACT_EMAIL}`}>{DATA_POLICY_CONTACT_EMAIL}</a>;

  return (
    <main className="page">
      <article className="panel stack">
        <h1>Chính sách xử lý dữ liệu cá nhân</h1>
        <p>Hiệu lực từ: 22/11/2026</p>

        <h2>1. Đơn vị chịu trách nhiệm</h2>
        <p>Đoàn TNCS Hồ Chí Minh Trường Đại học Quốc tế Hồng Bàng (Đoàn Trường) là đơn vị quyết định mục đích và cách xử lý dữ liệu trên Văn phòng điện tử Đoàn – Hội HIU. Liên hệ về dữ liệu cá nhân: {contact}.</p>

        <h2>2. Dữ liệu được thu thập</h2>
        <ul>
          <li>Tài khoản: mã số sinh viên, email sinh viên HIU, PIN (chỉ lưu dạng mã hóa một chiều).</li>
          <li>Thông tin sinh viên: họ tên, ngày sinh, giới tính, số điện thoại, lớp, khoa, khóa, địa chỉ.</li>
          <li>Hồ sơ Đoàn viên: ngày và nơi vào Đoàn, số thẻ Đoàn viên, ngày vào Đảng (nếu có), trình độ văn hóa, chuyên môn, lý luận chính trị, tin học, ngoại ngữ, nghề nghiệp.</li>
          <li>Dữ liệu nhạy cảm: số CCCD, dân tộc, tôn giáo.</li>
          <li>Hoạt động: đăng ký tham gia, điểm danh, điểm rèn luyện dự kiến, phản hồi biểu mẫu.</li>
          <li>Đoàn phí: mã đơn, số tiền, trạng thái, mã giao dịch do cổng thanh toán cung cấp. Hệ thống không lưu số thẻ hay thông tin tài khoản ngân hàng.</li>
          <li>Nhật ký hệ thống: thời điểm thao tác, loại thao tác, mã yêu cầu; MSSV trong nhật ký được che một phần.</li>
        </ul>

        <h2>3. Mục đích</h2>
        <ul>
          <li>Xác minh và quản lý tài khoản sinh viên.</li>
          <li>Tiếp nhận, xét và công nhận hồ sơ Đoàn viên theo quy định của Đoàn.</li>
          <li>Tổ chức chương trình, đăng ký, điểm danh, đề nghị điểm rèn luyện.</li>
          <li>Thu và đối soát Đoàn phí.</li>
          <li>Bảo đảm an toàn hệ thống và điều tra sự cố.</li>
        </ul>
        <p>Dữ liệu không được dùng cho quảng cáo hay mục đích thương mại.</p>

        <h2>4. Ai được xem dữ liệu</h2>
        <ul>
          <li>Bạn xem được toàn bộ thông tin bạn đã khai.</li>
          <li>Cán bộ Đoàn Khoa, Văn phòng Đoàn – Hội, Đoàn Trường chỉ xem dữ liệu trong phạm vi đơn vị phụ trách và đúng nhiệm vụ.</li>
          <li>CCCD, dân tộc, tôn giáo chỉ hiện khi cán bộ chủ động mở để xét hồ sơ; mỗi lần mở đều được ghi nhận (ai, lúc nào). Các trường này không có trong bất kỳ tệp xuất CSV nào và không được ghi vào nhật ký ứng dụng.</li>
        </ul>

        <h2>5. Nơi lưu trữ và bên xử lý</h2>
        <p>Hệ thống dùng dịch vụ Supabase (cơ sở dữ liệu, đăng nhập) với máy chủ đặt tại Singapore và Vercel (máy chủ web); cổng thanh toán xử lý giao dịch Đoàn phí. Các bên này chỉ xử lý dữ liệu để vận hành hệ thống. Dữ liệu được mã hóa khi truyền và khi lưu trữ.</p>

        <h2>6. Thời gian lưu trữ</h2>
        <ul>
          <li>Tài khoản và hồ sơ: trong thời gian bạn học tại trường và 12 tháng sau khi tốt nghiệp hoặc chuyển sinh hoạt Đoàn, sau đó được xóa hoặc ẩn danh, trừ dữ liệu phải lưu theo quy định của Đoàn.</li>
          <li>Nhật ký truy cập thông tin nhạy cảm: 24 tháng.</li>
          <li>Dữ liệu Đoàn phí: theo thời hạn lưu chứng từ thu chi của Đoàn.</li>
        </ul>

        <h2>7. Quyền của bạn</h2>
        <p>Bạn có quyền: được biết về việc xử lý dữ liệu; xem và yêu cầu sửa dữ liệu sai; rút lại sự đồng ý; yêu cầu xóa hoặc hạn chế xử lý; phản đối việc xử lý; khiếu nại theo quy định pháp luật. Gửi yêu cầu tới {contact} kèm MSSV; Đoàn Trường phản hồi trong thời hạn pháp luật quy định. Nếu bạn rút lại đồng ý hoặc yêu cầu xóa dữ liệu bắt buộc, bạn có thể không dùng tiếp được các chức năng cần dữ liệu đó, ví dụ xét hồ sơ Đoàn viên.</p>

        <h2>8. Khi có sự cố</h2>
        <p>Nếu xảy ra lộ lọt dữ liệu, Đoàn Trường sẽ xử lý, thông báo cho người bị ảnh hưởng và cơ quan có thẩm quyền theo quy định.</p>

        <h2>9. Căn cứ</h2>
        <p>Luật Bảo vệ dữ liệu cá nhân (hiệu lực từ 01/01/2026) và Nghị định 356/2025/NĐ-CP.</p>

        <h2>10. Thay đổi chính sách</h2>
        <p>Khi chính sách thay đổi, hệ thống thông báo trên trang này kèm ngày hiệu lực mới; thay đổi về mục đích hoặc loại dữ liệu nhạy cảm sẽ hỏi lại sự đồng ý của bạn.</p>

        <Link href="/register">Quay lại đăng ký</Link>
      </article>
    </main>
  );
}
