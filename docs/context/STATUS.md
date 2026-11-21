# Trạng thái hiện tại

> Sổ bàn giao giữa các công cụ. **Ghi đè** khi cập nhật, giữ dưới 150 dòng. Lịch sử đầy đủ xem `git log`, CHANGELOG, Issues.

**Cập nhật lần cuối:** 22/11/2026
**Phiên bản mới nhất:** v1.2.1 (tag trên `2baaf97`). Bản nộp môn học: tag `course-final`.

## Giai đoạn hiện tại: 1 – Dọn code để vận hành thật
- [x] Gắn tag `course-final` trên `cf91cf8` và push lên GitHub
- [ ] Xóa tài liệu, bằng chứng môn học khỏi main (TH1–TH4, Final, reports)
- [ ] Bỏ PayPal (D-005)
- [ ] Log ra stdout (D-007)
- [ ] Bỏ `package-release.sh`; đánh dấu `backup.sh`/`restore.sh` chỉ dùng local
- [x] Rút gọn `AGENTS.md`, `CLAUDE.md` chỉ còn `@AGENTS.md` (#89)
- [ ] Thay danh mục lớp bằng `data/danh-muc-lop.csv` (415 lớp)
- [ ] Sửa #83 (link xác minh email)
- [ ] Bảo vệ dữ liệu nhạy cảm, ô đồng ý, trang chính sách (D-006)
- [ ] Phát hành v1.3.0

## Tiếp theo
- **Giai đoạn 1:** dọn tài liệu môn học trước, sau đó thực hiện lần lượt các mục chưa đánh dấu ở trên.
- **Giai đoạn 2:** tạo Supabase Cloud + Vercel cho staging; cấu hình Auth (Site URL, Redirect URLs), SMTP gửi mail thật; runbook sao lưu cloud.
- **Giai đoạn 3:** production `doanhoihiu.io.vn`, nhập danh mục và cán bộ Khoa NN&VHQT, tập huấn.
- **Giai đoạn 4:** cổng thanh toán thật.

## Đang chờ người dùng quyết định
- Tiền Đoàn phí về tài khoản nào: VietQR theo từng Đoàn Khoa, hay một merchant cấp Đoàn Trường (D-004).
- Tỷ lệ và kỳ Đoàn Khoa nộp lên Đoàn Trường.
- Danh sách cán bộ Đoàn Khoa NN&VHQT (không đưa vào repo).
- Nội dung trang chính sách dữ liệu.

## Vấn đề đã biết
- #83: link xác minh email quay về sai origin.
- Trang `/admin/membership` khó dùng: hiện mã trạng thái tiếng Anh, chọn vai trò bằng tay, hai form không rõ thứ tự.
- CSV Đoàn phí ghi ngày theo UTC.

## Lưu ý môi trường
- Không chạy `supabase db reset`. Không áp migration chưa merge vào DB đang dùng.
- Máy local có nhiều stack Supabase; ghi stack và cổng của máy vào `docs/context/LOCAL.md` (không commit).
