# Bằng chứng sao lưu và phục hồi – Lab03 mục 4.2 (issue #57)

Ngày chạy: 06/11/2026, 09:26 (+07). Runbook: [`docs/runbooks/backup-restore.md`](../../../runbooks/backup-restore.md).

- **Stack:** `eoffice-v100` (tách biệt, cổng 563xx), dữ liệu demo giả, migration `202610150003`. Không đụng stack dev chính.
- **Web:** bản build có logging (PR #56), `npm start` cổng 3400, trong worktree riêng.
- **Cách chạy:** `drill.sh` (bản sao script đã dùng, chạy từ thư mục repo) gọi `scripts/backup.sh` và `scripts/restore.sh` của branch này; đo thời gian từng bước bằng mili giây.

## Kết quả

| Bước | Tệp | Kết quả |
|---|---|---|
| 1. Số liệu trước | `1-truoc.txt` | 12 bảng chính (`auth.users` 7, `event_programs` 7, `program_registrations` 9, `union_applications` 4, `storage.objects` 3…), bản ghi mẫu kế hoạch/đăng ký/hồ sơ, sha256 của 3 file PDF |
| 2. Sao lưu | `2-backup.log`, `eoffice-v100_20261106T092608.{manifest,counts.tsv,sha256}` | `.dump` 784 KB (801 877 byte), 54 bảng, 3 file Storage 36 KB, 1 170 ms |
| 3. Gây hỏng | `3-gay-hong.log`, `3-sau-khi-hong.txt` | `UPDATE 4`: cả 4 đăng ký Hiến máu thành `rejected`, `UPDATE 2` tên/địa điểm kế hoạch, `DELETE 1` hồ sơ Đoàn viên; xóa 1 PDF, ghi đè 1 PDF |
| 5. Phục hồi | `5-restore.log` | Checksum khớp 5 file; Postgres 883 ms; Storage 310 ms; "Số bản ghi khớp lúc sao lưu: 54 bảng"; tổng 1 680 ms |
| 7. So sánh | `7-sau-phuc-hoi.txt`, `7-diff-truoc-sau.txt` | `diff` giữa trước và sau phục hồi rỗng: số bản ghi, bản ghi mẫu, sha256 PDF đều giống |
| 8. Smoke test | `8-smoke.log` | Bước 2–4 (`curl`): `/` 200, `/forms` 200, `/programs` 307 → `/login?next=%2Fprograms`, `/api/health` `db: ok`. Bước 5–8 (Playwright, tài khoản demo `2201110203`): 4/4 PASS. Tổng 8/8 PASS |
| 9. Kiểm tra an toàn | `9-kiem-tra-an-toan.log` | Phục hồi vào stack dev chính bị từ chối (mã 77). Bản sao lưu có file bị sửa: dừng ở bước checksum (mã 65) |

## Thời gian (`timings.tsv`)

| Bước | ms |
|---|---|
| 1. Ghi số liệu trước | 610 |
| 2. Sao lưu | 1 406 |
| 3. Gây hỏng dữ liệu | 355 |
| 4. Dừng web | 404 |
| 5. Phục hồi | 1 951 |
| 6. Khởi động web đến khi `/api/health` = 200 | 1 731 |
| 7. So sánh trước/sau | 657 |
| 8. Smoke test | 9 179 |
| **RTO kỹ thuật (bước 4 → 8)** | **14 063** |
| Tổng diễn tập | 17 150 |

Từ số liệu này, runbook đề xuất RPO 1 giờ, RTO 30 phút (lý do ở mục 2 của runbook).

Không commit file `.dump` và thư mục `.storage/` (nằm trong `backups/`, đã `.gitignore`). Dữ liệu trong các tệp này là dữ liệu demo giả; tệp `.sha256` chỉ có đường dẫn và mã băm.
