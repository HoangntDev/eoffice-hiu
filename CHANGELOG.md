# Changelog

Mọi thay đổi đáng chú ý của HIU Youth E-Office được ghi ở đây.
Định dạng theo [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/); phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

## [1.0.1] - 2026-11-06

Bản vá sau sự cố INC-01-ThieuCauHinh, kèm nâng cấp bảo mật. Không đổi cơ sở dữ liệu (không có migration mới); nâng từ 1.0.0 chỉ cần thay gói và chạy `npm ci`.

### Fixed

- **INC-01-ThieuCauHinh** (#59): thiếu hoặc sai cấu hình bắt buộc nay bị phát hiện ngay lúc khởi động, thay vì chỉ lộ ra khi người dùng thao tác.
  - Lúc khởi động, hệ thống kiểm tra 4 biến `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_RATE_LIMIT_PEPPER` và thử service role key. Lỗi được ghi `config.invalid` kèm tên biến (không ghi giá trị); `/api/health` trả 503 với `config: "error"`.
  - Thiếu `NEXT_PUBLIC_SUPABASE_URL` hoặc publishable key: trước đây mọi trang trả "Internal Server Error" thô, do bản build bỏ mất phép kiểm tra cấu hình trong proxy. Nay trả trang 503 "Hệ thống tạm thời chưa sẵn sàng" kèm mã tham chiếu.
  - Service role key sai: đăng nhập trước đây trả 500 "Không thể xử lý yêu cầu", nay trả 503 kèm mã tham chiếu và có log.
- Điểm danh QR (#61): token sai định dạng UUID trả 422 `QR_INVALID` ("Mã QR không hợp lệ…") thay vì 500, và không gửi xuống database.
- Trang chủ khách không còn hai cặp nút Đăng nhập/Tạo tài khoản: hai nút chỉ nằm ở thanh đầu trang, và nay hiện cả trên điện thoại. Banner có nút "Xem biểu mẫu đang mở". Hướng dẫn rút còn 3 bước, không lặp ý với thẻ chức năng (#36).

### Security

- Nâng `next` 16.3.8 → 16.4.5 (critical: GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr) và `eslint-config-next` theo cùng (#63).
- Nâng `zod` 4.6.5 → 4.6.7 (high: GHSA-mrhx-c7xc-m3w5) (#63).
- `npm audit --omit=dev`: 0 lỗ hổng. Các lỗ hổng còn lại chỉ nằm trong công cụ phát triển (vitest, vite, undici qua jsdom, minimatch qua typescript-eslint).

### Added

Cải tiến vận hành, không đổi hành vi nghiệp vụ của người dùng:

- Log JSON ra file `logs/app-YYYY-MM-DD.log` (winston, xoay theo ngày, giữ 7 file), vẫn ghi console; mỗi dòng có `ts`, `level`, `source`, `event`, `requestId`. Ghi khởi động/dừng, lỗi chưa xử lý, giao dịch chính, lỗi/chậm khi gọi database (ngưỡng `DB_SLOW_MS`), đăng nhập sai và truy cập bị từ chối (MSSV đã che, IP). Không ghi PIN, token, cookie, email đầy đủ (#55).
- `GET /api/health` trả `{app, db, config, version}` cho giám sát và smoke test (#55, #59).
- Lỗi chưa xử lý hiện trang thân thiện kèm mã tham chiếu khớp với log; lỗi API 500/503 có thêm mã tham chiếu trong thông báo (#55).
- `scripts/backup.sh` và `scripts/restore.sh`: sao lưu/phục hồi Postgres (public, auth, storage) và file PDF kế hoạch bằng một lệnh, có checksum; runbook `docs/runbooks/backup-restore.md`, RPO 1 giờ, RTO 30 phút (#57).

## [1.0.0] - 2026-10-20

Phiên bản phát hành đầu tiên của Final Project. Tính từ baseline `course-baseline`.

### Added

**UC-A – Hồ sơ Đoàn viên**
- Sinh viên kê khai hồ sơ Đoàn viên theo năm học, lưu nháp hoặc nộp, và theo dõi trạng thái.
- Văn phòng ghi nhận đã tiếp nhận Sổ Đoàn, hoặc ghi nhận sinh viên đã rút Sổ. CTV được phân công kiểm tra và đề xuất. Văn phòng hoặc Đoàn Trường công nhận, yêu cầu bổ sung hoặc từ chối, kèm lý do.
- Hệ thống chặn công nhận khi Văn phòng chưa tiếp nhận Sổ Đoàn. CTV không được duyệt cuối.

**UC-B – Kế hoạch chương trình**
- Đoàn Khoa lập kế hoạch kèm file PDF và nộp cho Văn phòng Đoàn – Hội.
- Văn phòng chấp thuận, yêu cầu chỉnh sửa hoặc từ chối. Hai lựa chọn sau bắt buộc ghi lý do. Người lập không tự duyệt kế hoạch của mình.

**UC-C – Đăng ký tham gia**
- Ban tổ chức cấu hình đăng ký: đối tượng (Khoa, Lớp…), chỉ tiêu, hạn đăng ký, có cần duyệt hay không.
- Sinh viên đăng ký và được báo rõ lý do khi không đăng ký được: chưa mở, đã đóng, hết chỗ, không thuộc đối tượng.
- Ban tổ chức duyệt hoặc từ chối đăng ký có lý do, và xuất danh sách.

**UC-D – Điểm danh QR theo lượt**
- Ban tổ chức đặt kế hoạch điểm danh nhiều lượt và quy tắc tính điểm, mở hoặc đóng từng lượt.
- QR đổi mỗi 30 giây; hạn được kiểm theo giờ server.
- Sinh viên quét QR để điểm danh, mỗi lượt một lần, và chỉ khi đã có đăng ký được nhận.
- Hệ thống tính **điểm rèn luyện dự kiến đề nghị**. Thư ký Khoa cấp điểm chính thức ngoài hệ thống.

**Phần nền**
- Tài khoản đăng nhập bằng MSSV 10 chữ số và PIN 6 chữ số. Xác minh bằng email sinh viên `@student.hiu.vn`, có khôi phục PIN.
- Danh mục học vụ (Khoa, Ngành, Lớp, Khóa) và cơ cấu tổ chức Đoàn – Hội, phân quyền theo đơn vị.
- Biểu mẫu động: thư viện mẫu, tạo và phát hành biểu mẫu, thu phản hồi, xuất CSV.
- Trang chủ sau đăng nhập có khối "Việc của tôi" theo vai trò. Thanh trên cùng hiện họ tên và MSSV (#18).
- Dữ liệu demo tiếng Việt cho một stack Supabase tách biệt (`npm run demo:seed`) (#18).
- Biến `LOG_LEVEL` chỉnh mức log của server; mặc định dev → `debug`, production → `info` (#26).

### Changed

- Menu và các nút chỉ hiện chức năng đúng vai trò của người dùng (#18).
- Danh sách chương trình và biểu mẫu hiển thị dạng thẻ trên điện thoại (#18).
- Cấu hình được đọc lúc chạy: cùng một bản build dùng được cho nhiều môi trường, chỉ cần đổi `.env.local` (#32).
- Cố định phiên bản mọi dependency trực tiếp. Nâng Next.js 16.3.6 → 16.3.8 để vá 6 lỗ hổng mức cao (#26).
- CI chạy build, toàn bộ unit test và pgTAP (Postgres trong runner) cho mỗi PR và mỗi lần push lên `main`. Kết quả test lưu thành artifact (#24).

### Fixed

- K1 – Quét QR khi chưa đăng nhập: sau khi đăng nhập, sinh viên được đưa về đúng trang điểm danh, không phải quét lại (#30).
- K3 – Kiểm thử nghiệp vụ trong database (pgTAP, 205 assertion) nay chạy trên CI (#24).
- K4 – README ghi đúng quy tắc email `@student.hiu.vn` và đúng cách chạy (#8).
- K6 – Radio/checkbox ở trang điền biểu mẫu nằm sát nhãn, không còn bị kéo giãn (#18).
- K7 – Sinh viên không còn thấy menu "Cơ cấu", "Xử lý hồ sơ" và các nút quản lý biểu mẫu (#18).
- K9 – Bảng không còn bị bóp hẹp, mất nút trên điện thoại (#18).
- Hạn nhận phản hồi của biểu mẫu hiển thị theo giờ Việt Nam. Tên đơn vị không còn lặp "Đoàn Khoa Khoa". Trạng thái hồ sơ hiển thị bằng tiếng Việt (#18).

### Known issues

- **Chưa có thanh toán online** qua cổng thanh toán ở môi trường sandbox. Dự kiến hoàn thành trước 13/11/2026.
- Chưa gồm nghiệm thu chương trình và điểm uy tín (nhánh `feat/program-acceptance`), cũng như đăng bài sau nghiệm thu (nhánh `feat/program-publication`). Hai phần này chưa thuộc bản 1.0.0.
- K2 – QR điểm danh dùng chung cho cả lượt, nên trong 30 giây hiệu lực vẫn có thể bị chụp lại và gửi cho người khác. Đây là giới hạn thiết kế đã chấp nhận. Hệ thống vẫn yêu cầu đăng nhập, đăng ký được nhận và mỗi lượt chỉ một lần.
- K5 – Tên một số migration mang ngày 14–15/10, trong khi thực tế được tạo ngày 13/10/2026. Không đổi tên được vì đã áp lên DB. Không ảnh hưởng người dùng.

[Unreleased]: https://github.com/HoangntDev/eoffice-hiu/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/HoangntDev/eoffice-hiu/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0.0
