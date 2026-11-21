# Quyết định đã chốt

Chỉ thêm mới. Muốn đổi một quyết định thì thêm mục mới ghi rõ "thay cho D-xxx". Không ghi secret hay dữ liệu cá nhân.

## D-001 – Kết thúc môn học, chuyển sang vận hành thật (22/11/2026)
- Bản nộp môn học được lưu bằng tag `course-final`. Từ đây mục tiêu là đưa hệ thống vào sử dụng thật.
- Bỏ các phần chỉ phục vụ môn học (xem D-005, D-007, D-008).

## D-002 – Hạ tầng (22/11/2026)
- Database, Auth, Storage: Supabase Cloud, vùng Singapore. Web: Vercel.
- Domain: `doanhoihiu.io.vn`. Có môi trường staging riêng trước production.
- Dữ liệu thật cần gói Supabase có sao lưu tự động (gói miễn phí không có).

## D-003 – Thí điểm (22/11/2026)
- Thí điểm cho Đoàn Khoa Ngôn ngữ & Văn hoá Quốc tế (32 lớp theo danh mục 11/2026).
- Danh mục lớp toàn trường: `data/danh-muc-lop.csv` (6 cột, không có thông tin cá nhân).
- Danh sách cán bộ và sinh viên thật không bao giờ đưa vào repo; chỉ nhập thẳng vào database production.

## D-004 – Đoàn phí (22/11/2026)
- Thu 2 cấp: Đoàn viên đóng cho Đoàn Khoa; Đoàn Khoa nộp cho Đoàn Trường.
- Mức thu tháng: 2.000 / 5.000 / 10.000 / 20.000 đ; sinh viên đóng gộp 12 tháng; số tiền do database tính.
- Mỗi Đoàn Khoa chỉ một khoản thu mỗi năm, một mức cho cả khoản.
- Chọn chi đoàn áp dụng: tích chọn (có chọn/bỏ tất cả, ít nhất một); thêm chi đoàn sau được; bỏ tích được kể cả khi đã có người đóng (giữ giao dịch, hiện cảnh báo, không hoàn tiền trong hệ thống); audit mọi thay đổi; checkout từ chối sinh viên không thuộc chi đoàn đã chọn. Thông báo cho người đã đóng: làm sau.
- Dùng cổng thanh toán thật (VND). **Chưa chốt:** tiền về tài khoản nào (VietQR theo từng Đoàn Khoa hay một merchant cấp Đoàn Trường) và tỷ lệ, kỳ nộp lên Đoàn Trường.

## D-005 – Bỏ PayPal (22/11/2026)
- Bỏ PayPal sandbox và quy đổi USD. Giữ interface `PaymentGateway`; `FakeGateway` chỉ dùng trong test.
- Công tắc `PAYMENT_ENABLED` mặc định TẮT cho tới khi có cổng thật.

## D-006 – Dữ liệu cá nhân (22/11/2026)
- CCCD và tôn giáo là thông tin bắt buộc trong hồ sơ Đoàn viên.
- Chỉ sinh viên chủ hồ sơ và cán bộ xét hồ sơ được xem; mỗi lần cán bộ mở phần nhạy cảm phải ghi audit.
- Không xuất CCCD, tôn giáo trong bất kỳ file CSV nào; không ghi vào log.
- Đăng ký tài khoản phải có ô đồng ý xử lý dữ liệu cá nhân (lưu thời điểm đồng ý) và trang chính sách dữ liệu.
- Căn cứ pháp lý: Luật Bảo vệ dữ liệu cá nhân (hiệu lực 01/01/2026), Nghị định 356/2025/NĐ-CP.

## D-007 – Logging (22/11/2026)
- Log JSON ra stdout/stderr (Vercel không có ổ đĩa lâu dài); bỏ ghi file `logs/`.
- Giữ `requestId`, che MSSV; không bao giờ ghi PIN, token, cookie, CCCD, tôn giáo.

## D-008 – Tài khoản tổ chức (CR-01) (22/11/2026)
- Chỉ Đoàn Trường, Văn phòng Đoàn – Hội, Đoàn Khoa có tài khoản tổ chức; không bao giờ có ở cấp Chi đoàn.
- Công tắc `ORG_ACCOUNTS_ENABLED` giữ lại nhưng luôn bật ở production; gỡ đường chạy cũ để sau.
- Người duyệt thí điểm: Đoàn Trường.

## D-009 – Quy trình làm việc (22/11/2026)
- Giữ: issue → branch → commit có số issue → PR → CI xanh → merge commit; test RED trước GREEN khi sửa lỗi.
- Bỏ: milestone TH, ảnh chụp bằng chứng, báo cáo môn học.
- Commit, PR, issue không ghi dấu hiệu công cụ AI.
- Dùng nhiều công cụ (Codex, Claude Code, Antigravity); bộ nhớ chung theo mục "Bộ nhớ dùng chung" trong `AGENTS.md`.
