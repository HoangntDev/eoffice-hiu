# Script đóng gói có tự kiểm tra (issue #71)

Ngày 06/11/2026. Biện pháp phòng ngừa sự cố đóng gói v1.0.1 (gói tải lên lần đầu thiếu symlink `.next/node_modules/winston-*`, xem `docs/TH3/INC-01-ThieuCauHinh/incident-report.md`). Cách dùng: `docs/release/huong-dan-trien-khai.md`, mục 7.

| Lần chạy | Tệp | Kết quả |
|---|---|---|
| `scripts/package-release.sh 1.0.1` | `1-package-v1.0.1.log`, `dist-hiu-youth-e-office-v1.0.1.zip.sha256` | Worktree sạch tại `v1.0.1` (`fb5eb99`) → `npm ci` → build → ghép gói (8 349 263 byte, SHA-256 `d4a05deb…`) → tự kiểm tra: `npm ci`, khởi động cổng 3990, `/api/health` = `{"app":"ok","db":"error","config":"ok","version":"1.0.1"}` → **ĐẠT**, exit 0, gói ở `dist/` |
| `--verify` gói tải lên lần đầu (SHA-256 `b3ba5289…`) | `2-verify-goi-loi.log` | `.next/node_modules rỗng: thiếu symlink tới module ngoài` → **THẤT BẠI**, exit 1; không có gì được đưa ra để tải lên |
| `--verify` gói đang có trên Release (SHA-256 `0f4a744b…`) | `3-verify-goi-tren-release.log` | Checksum OK, `/api/health` đúng version → **ĐẠT** |

Ảnh `package-release-terminal.png`: cửa sổ Terminal (screencapture) của hai lần chạy đầu.

Gói tạo bằng script **không** được tải lên: tài sản của Release v1.0.1 giữ nguyên (`hiu-youth-e-office-v1.0.1.zip`, 8 349 325 byte, cập nhật lần cuối 03:20:14Z). SHA-256 của gói mới khác gói trên Release là bình thường: mỗi lần build sinh build ID mới (`.next/static/<build id>/`) và thời gian trong zip khác; danh sách file của hai gói đều có 1 914 mục, chỉ khác thư mục build ID.

`db: "error"` trong lúc tự kiểm tra là đúng thiết kế: script dùng biến giữ chỗ trỏ tới `127.0.0.1:9` để không gọi Supabase thật.

Trong lúc viết script có hai lỗi đã sửa trước khi commit: thông báo khi `.next/node_modules` rỗng in sai tên (`*`), và Bash 3.2 của macOS báo `unbound variable` với mảng rỗng khi `set -u`. Log trong thư mục này là của lần chạy sau khi sửa.
