# Trạng thái hiện tại

> Sổ bàn giao giữa các công cụ. **Ghi đè** khi cập nhật, giữ dưới 150 dòng. Lịch sử đầy đủ xem `git log`, CHANGELOG, Issues.

**Cập nhật lần cuối:** 22/11/2026
**Phiên bản mới nhất:** v1.2.1 (tag trên `2baaf97`). Bản nộp môn học: tag `course-final`.

## Giai đoạn hiện tại: 1 – Dọn code để vận hành thật
- [x] Gắn tag `course-final` trên `cf91cf8` và push lên GitHub
- [x] Dọn tài liệu và bằng chứng môn học, cập nhật README vận hành (#91)
- [x] Bỏ PayPal sandbox, giữ khả năng đọc đơn cũ (D-005, D-010, #93)
- [x] Log JSON ra stdout/stderr (D-007, #95)
- [x] Bỏ `package-release.sh`; đánh dấu `backup.sh`/`restore.sh` chỉ dùng local (#96)
- [x] Rút gọn `AGENTS.md`, `CLAUDE.md` chỉ còn `@AGENTS.md` (#89)
- [x] Danh mục tháng 11 gồm 414 lớp, trong đó có 32 lớp thí điểm (#103, #104).
- [x] Sửa #83: callback giữ origin công khai khi chuyển sang tạo PIN
- [x] Giới hạn và audit khi mở định danh, lọc cột nhạy cảm trong CSV (D-006, #100)
- [ ] Ô đồng ý đăng ký, lưu thời điểm và trang chính sách (D-006)
- [ ] Phát hành v1.3.0

## Tiếp theo
- **Giai đoạn 1:** cập nhật danh mục lớp và bảo vệ dữ liệu nhạy cảm.
- **Giai đoạn 2:** tạo Supabase Cloud + Vercel cho staging; cấu hình Auth (Site URL, Redirect URLs), SMTP gửi mail thật; runbook sao lưu cloud.
- **Giai đoạn 3:** production `doanhoihiu.io.vn`, nhập danh mục và cán bộ Khoa NN&VHQT, tập huấn.
- **Giai đoạn 4:** cổng thanh toán thật.

## Đang chờ người dùng quyết định
- Tiền Đoàn phí về tài khoản nào: VietQR theo từng Đoàn Khoa, hay một merchant cấp Đoàn Trường (D-004).
- Tỷ lệ và kỳ Đoàn Khoa nộp lên Đoàn Trường.
- Danh sách cán bộ Đoàn Khoa NN&VHQT (không đưa vào repo).
- Nội dung trang chính sách dữ liệu.

## Vấn đề đã biết
- Trang `/admin/membership` khó dùng: hiện mã trạng thái tiếng Anh, chọn vai trò bằng tay, hai form không rõ thứ tự.
- CSV Đoàn phí ghi ngày theo UTC.

## Lưu ý môi trường
- Không chạy `supabase db reset`. Không áp migration chưa merge vào DB đang dùng.
- Máy local có nhiều stack Supabase; ghi stack và cổng của máy vào `docs/context/LOCAL.md` (không commit).
