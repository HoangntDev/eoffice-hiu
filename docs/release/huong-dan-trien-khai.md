# Dựng và quay lui bản phát hành local

1. Chọn tag phát hành đã duyệt và kiểm tra commit bằng `git show <tag>`.
2. Tạo thư mục chạy riêng bằng `git worktree add --detach <thư-mục> <tag>`.
3. Trong thư mục vừa tạo, cài bằng `npm ci`, cấu hình môi trường local theo [README](../../README.md), chạy `npm run build` rồi `npm start`.
4. Kiểm tra `GET /api/health` trả 200, phiên bản đúng tag và chạy [smoke test](../testing/smoke-test.md) trên stack tách biệt.

## Quay lui

Khi hai bản dùng cùng schema, dừng tiến trình web đang phục vụ, khởi động bản đã kiểm tra ở tag trước với cùng cấu hình môi trường, rồi kiểm tra lại health và smoke test. Nếu có thay đổi schema, cần phương án tương thích hoặc phục hồi dữ liệu đã được duyệt trước khi quay lui.

Quy trình sao lưu và phục hồi cho stack Docker nằm trong [runbook local](../runbooks/backup-restore.md). Môi trường cloud và triển khai staging, production cần phê duyệt riêng.

Các bản ZIP đã phát hành đến v1.2.1 có [hướng dẫn theo tag](https://github.com/HoangntDev/eoffice-hiu/blob/v1.2.1/docs/release/huong-dan-trien-khai.md).
