# Diễn tập rollback v1.0.1 → v1.0.0 (issue #69)

Ngày 06/11/2026, 16:40 (+07). Stack tách biệt `eoffice-v100` (dữ liệu demo giả), cổng 3500. Không đụng DB local đang dùng.

**Kiểm tra schema trước khi rollback:** `git diff --stat v1.0.0 v1.0.1 -- supabase/` rỗng; migration cuối của cả hai tag là `202610150003`. Kết luận: v1.0.1 không đổi schema, nên rollback chỉ cần thay mã chạy, không phải gỡ migration hay phục hồi DB; dữ liệu ghi bởi v1.0.1 vẫn dùng được với v1.0.0.

**Chuẩn bị (không tính giờ, `0-chuan-bi.log`):** đưa dữ liệu stack thử về bản sao lưu `eoffice-v100_20261106T092608` để smoke bước 7 còn sinh viên demo chưa đăng ký; kiểm gói v1.0.1 đang cài khớp SHA-256 trên Release (`0f4a744b…`); khởi động v1.0.1, `/api/health` = `{"app":"ok","db":"ok","config":"ok","version":"1.0.1"}`.

**Sự cố giả định:** v1.0.1 vừa phát hành gặp lỗi nghiêm trọng, quyết định rollback về v1.0.0.

| Bước | Bắt đầu | Kết thúc | Thời gian |
|---|---|---|---|
| 1. Quyết định rollback (kiểm schema, `scripts/backup.sh eoffice-v100`) | 16:40:36 | 16:40:37 | 1 199 ms |
| 2. Dừng bản mới v1.0.1 (`kill -TERM`, log `app.stop`) | 16:40:37 | 16:40:37 | 155 ms |
| 3. Cài bản cũ v1.0.0 từ Release (tải, checksum OK, giải nén, `npm ci` 14 s, khởi động đến khi `/` = 200) | 16:40:37 | 16:40:56 | 19 255 ms |
| 4. Smoke test 8 bước | 16:40:56 | 16:41:08 | 11 895 ms |
| **Từ quyết định rollback tới smoke xong** | | | **32 588 ms** |

Smoke test trên v1.0.0 sau rollback (`smoke.log`): bước 1 `Ready`, bước 2 `/` 200, bước 3 `/forms` 200 có biểu mẫu demo, bước 4 `/programs` 307 → `/login?next=%2Fprograms`, bước 5–8 Playwright 4/4 PASS. **8/8 PASS.** `/api/health` trả 404 vì v1.0.0 chưa có health check, đúng như mong đợi.

Ghi chú bước 3 của smoke: script đếm chữ "running" trong `supabase status` nên in "0 dịch vụ running"; Supabase CLI 2.117 không in chữ đó. Đã kiểm lại ngay sau bằng `docker inspect` (cuối `smoke.log`): db, auth, kong, storage running healthy, rest running. Bước 3 đạt.

`npm ci` nhanh vì máy đã có cache npm; trên máy mới bước 3 sẽ lâu hơn.

| Tệp | Nội dung |
|---|---|
| `rollback-terminal.png` | Ảnh cửa sổ Terminal (screencapture) chạy toàn bộ diễn tập |
| `drill-terminal.log` | Output đầy đủ của lần chạy đó |
| `timings.tsv` | Bảng thời gian |
| `smoke.log`, `v1.0.0-npm-start.log` | Smoke test sau rollback, log khởi động v1.0.0 |
| `0-chuan-bi.log` | Bước chuẩn bị |
| `rollback-drill.sh` | Script đã chạy |
