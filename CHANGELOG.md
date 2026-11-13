# Changelog

Mọi thay đổi đáng chú ý của HIU Youth E-Office được ghi ở đây.
Định dạng theo [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/); phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

## [1.2.1] - 2026-11-13

Bản vá phiên đăng nhập. Không có migration, không đổi schema; nâng cấp từ 1.2.0 chỉ cần thay gói.

### Fixed

- Đăng xuất không còn kẹt ở "Đang đăng xuất…" (#84): bỏ header `Clear-Site-Data: "cache"`,
  `signOut` dùng `scope: "local"` và có giới hạn thời gian; dù Auth lỗi, route vẫn xóa mọi cookie
  `sb-*` và trả 200. Nút đăng xuất có timeout 8 giây, luôn chuyển về trang đăng nhập và hiện thông
  báo lỗi nhìn thấy được.
- Đăng xuất phiên tổ chức kết thúc phiên cán bộ (`end_officer_session`) và chuyển về
  `/admin/login`; phiên sinh viên về `/login` (#84). Log `auth.logout` ghi kết quả, không ghi
  token hay cookie.
- Cookie của phiên đã bị thu hồi (sau đăng xuất, "Đổi cán bộ", thu hồi thành viên) không còn làm
  mọi trang trả 500 (#85). Proxy hỏi Auth khi có cookie phiên; phiên không còn thì xóa cookie và chuyển
  về `/login` (hoặc `/admin/login` với khu quản trị). Lỗi hạ tầng (Auth không gọi được, 5xx) vẫn trả
  503 có mã tham chiếu, không bị coi là "chưa đăng nhập". Server Component không ném lỗi khi
  supabase-js cố xóa cookie trong lúc render.

### Tests

- Vitest `tests/logout-session.test.ts` và `tests/logout-button.test.tsx` (14 test): commit RED trước,
  commit sửa sau (#84, #85).

## [1.2.0] - 2026-11-13

Thanh toán Đoàn phí trực tuyến (#81). Trang đăng ký VNPay sandbox
(`sandbox.vnpayment.vn/devreg/`) trả 404 trong ngày 11–12/11/2026 nên không lấy được
mã merchant; bản này chạy thật bằng **PayPal sandbox** (`PAYMENT_PROVIDER=paypal`) và
giữ nguyên `VnpayGateway` để chuyển lại khi có mã VNPay.

### Added

- Đoàn Khoa tạo khoản Đoàn phí cho một năm dương lịch với một trong bốn mức
  2.000, 5.000, 10.000 hoặc 20.000 đồng/tháng; database tính khoản đóng gộp 12 tháng (#81).
- Sinh viên xem khoản phải đóng, chuyển sang VNPay hoặc PayPal sandbox và xem biên nhận gồm
  mã giao dịch, số tiền, mức tháng, năm và thời gian. Không chặn hồ sơ Đoàn viên khi chưa đóng (#81).
- Danh sách đã đóng/chưa đóng theo Khoa, lọc theo lớp và CSV có cột tháng 1–12 để
  cán bộ nhập lại hệ thống quản lý đoàn viên Trung ương (#81).
- Công tắc database `PAYMENT_ENABLED`; khi tắt, chức năng thanh toán bị ẩn và hệ
  thống giữ hành vi v1.1.0 (#81).
- `PaypalGateway` dùng Orders API v2: lấy OAuth token phía server, tạo order
  `CAPTURE`, quy đổi VND sang USD theo cấu hình và cho phép hủy rồi thanh toán lại (#81).

### Security

- Tách `PaymentGateway`, `VnpayGateway`, `PaypalGateway` và `FakeGateway`. VNPay
  kiểm HMAC-SHA512; PayPal chỉ ghi nhận sau capture server-to-server trả `COMPLETED`
  và khớp mã đơn, currency, số tiền. Trang kết quả không ghi trạng thái (#81).
- RPC chỉ ghi nhận khi mã đơn đang chờ, số tiền khớp mức × 12 và giao dịch thành
  công. IPN lặp idempotent; sinh viên và Đoàn Khoa khác bị RLS chặn (#81).
- Log thanh toán chỉ ghi mã đơn, mã giao dịch/capture, trạng thái đối chiếu, số tiền và MSSV
  che giữa; không ghi secret, chữ ký hoặc dữ liệu thẻ (#81).

### Changed

- Giao dịch lỗi hoặc hủy có thể tạo đơn mới; giao dịch đã đóng đủ năm bị chặn đóng
  trùng. Hệ thống không cung cấp chức năng hoàn tiền (#81).
- Tăng phiên bản ứng dụng lên 1.2.0 và bổ sung hướng dẫn chuyển cổng/chạy PayPal
  hoặc VNPay sandbox (#81).

### Tests

- Thêm Vitest với FakeGateway và pgTAP cho bốn mức thu, số tiền năm, chữ ký/số
  tiền sai, đơn không tồn tại, callback lặp, PayPal capture sai trạng thái/custom_id/
  currency/amount, retry, chống đóng trùng, công tắc và phân quyền (#81).

### Migration và rollback

- Thêm migration `20261110224444_online_union_fee_payments.sql`,
  `20261111185625_expire_union_fee_orders.sql` và
  `20261112134412_paypal_payment_provider.sql`; migration mặc định để
  `PAYMENT_ENABLED` tắt. Quay lui hành vi bằng công tắc, không sửa hoặc chạy ngược
  migration đã phát hành.

### Fixed

- Khôi phục vùng nhập PIN 6 chấm ở bước 1 (PIN tổ chức) và PIN xác nhận cán bộ của
  đăng nhập tổ chức. Thay đổi ngoài phạm vi thanh toán, phát hiện khi chạy thử, có
  RED/GREEN riêng (#81).

### Known issues

- #84: bấm "Đăng xuất" có thể kẹt ở "Đang đăng xuất…"; đăng xuất phiên tổ chức không
  kết thúc phiên cán bộ và chuyển về `/login` thay vì `/admin/login`.
- #85: trình duyệt còn cookie của phiên đã bị thu hồi (sau đăng xuất, "Đổi cán bộ",
  thu hồi thành viên) thì mọi trang, kể cả `/login`, trả 500 cho tới khi xóa cookie.
  Cách tránh tạm thời: xóa cookie của site hoặc đóng mọi cửa sổ ẩn danh rồi mở lại.
- Hai lỗi trên có từ v1.1.0 và sẽ sửa ở bản vá sau v1.2.0.

## [1.1.0] - 2026-11-10

CR-01 tách toàn bộ thao tác quản lý sang tài khoản tổ chức. Không thay đổi hành vi
đăng ký tài khoản, hồ sơ, đăng ký chương trình và điểm danh QR của sinh viên.

### Added

- Tài khoản tổ chức cho Đoàn Trường, Văn phòng Đoàn – Hội và Đoàn Khoa; database
  từ chối tài khoản tổ chức cho Chi đoàn. Ban chưa nằm trong phạm vi phiên bản này (#37).
- Đăng nhập hai bước tại `/admin/login`: PIN tổ chức, sau đó MSSV + PIN cá nhân của
  cán bộ còn hiệu lực. Phiên tạm dùng một lần, hết hạn sau 5 phút; sai PIN tổ chức
  5 lần trong 15 phút theo đơn vị và IP thì bị giới hạn (#37).
- Khu vực `/admin` có menu theo loại đơn vị, nút "Đổi cán bộ", đổi PIN tổ chức và
  màn hình Đoàn Trường tạo, đặt lại PIN, khóa hoặc mở tài khoản tổ chức (#37).
- Công tắc database `ORG_ACCOUNTS_ENABLED`, chỉ Đoàn Trường đổi được trên giao diện
  và mọi lần đổi đều có audit. Khi tắt, hệ thống dùng lại quyền cá nhân như v1.0.0 (#37).
- Audit và lịch sử nghiệp vụ ghi đồng thời tài khoản tổ chức, đơn vị và cán bộ thao tác (#37).

### Changed

- Migration giữ nguyên các `role_grants` quản lý cá nhân để quay lui bằng công tắc;
  khi công tắc bật, RPC/RLS bỏ qua các grant này và chỉ nhận phiên tổ chức có cán bộ (#37).
- Chuyển các màn hình quản lý chương trình, biểu mẫu, hồ sơ Đoàn viên và cơ cấu tổ
  chức vào `/admin`; chức năng sinh viên giữ ở các đường dẫn cũ (#37).
- Viết lại `bootstrap_school_admin`: tạo đúng một tài khoản tổ chức Đoàn Trường,
  nhập PIN ẩn và thêm người chạy làm thành viên, không cấp quyền quản lý cho tài khoản cá nhân (#37).
- Seed demo tạo ba tài khoản tổ chức, giữ grant cá nhân để thử công tắc TẮT và ghi
  lịch sử bằng tài khoản tổ chức kèm cán bộ (#37).

### Security

- Nhánh không có tài khoản vẫn chạy kiểm tra PIN giả để giảm rò rỉ thời gian; mọi lỗi
  đăng nhập ở hai bước dùng cùng thông báo chung (#37).
- Phiên tổ chức chưa chọn cán bộ không đọc hoặc ghi được dữ liệu. "Đổi cán bộ" và
  thu hồi thành viên vô hiệu phiên cũ ngay, không chờ JWT hết hạn (#37).
- Log đăng nhập tổ chức chỉ ghi đơn vị, MSSV che giữa, IP và kết quả; không ghi PIN
  hoặc token (#37).

### Tests

- CI chạy pgTAP ở hai trạng thái: TẮT giữ nguyên 205 assertion cũ; BẬT đạt 306
  assertion. Vitest đạt 203 test; 19 test case UC-A–D và smoke 8 bước đều đạt (#37).

### Migration và rollback

- Thêm migration `20261109222454_cr01_organization_accounts.sql`. Migration tạo dữ
  liệu tài khoản tổ chức nhưng mặc định để công tắc TẮT, nên có thể kiểm tra trước khi bật.
- Không hạ schema bằng cách chạy migration ngược. Quay lui hành vi bằng cách tắt
  `ORG_ACCOUNTS_ENABLED`; muốn quay về database trước v1.1.0 phải phục hồi bản sao lưu.

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

[Unreleased]: https://github.com/HoangntDev/eoffice-hiu/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/HoangntDev/eoffice-hiu/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/HoangntDev/eoffice-hiu/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/HoangntDev/eoffice-hiu/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0.0
