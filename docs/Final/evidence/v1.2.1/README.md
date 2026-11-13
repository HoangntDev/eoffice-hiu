# Bằng chứng bản vá v1.2.1 (#84, #85)

Nhánh `fix/84-logout-hang`, PR #86. Không có migration.

## RED → GREEN

| Commit | Nội dung | Kết quả |
|---|---|---|
| `746c990` | RED: `tests/logout-session.test.ts` (10 test), `tests/logout-button.test.tsx` (4 test) | 13/14 thất bại đúng lý do: còn `Clear-Site-Data`, `signOut()` không có `scope: "local"`, không gọi `end_officer_session`, signOut lỗi trả 500, không có log `auth.logout`, proxy trả 200 cho cookie phiên đã thu hồi, không có 503 khi Auth lỗi, `setAll` ném lỗi trong Server Component, nút không timeout và không chuyển trang. Test chặn `next` lạ đạt ngay vì code cũ luôn về `/login`. Lint và typecheck sạch, nên CI chỉ đỏ ở bước test |
| `23d97c6` | GREEN: proxy, route đăng xuất, nút đăng xuất, `server.ts` | 14/14 đạt |

## Hồi quy (chạy trên `23d97c6`, 13/11/2026)

| Kiểm tra | Kết quả |
|---|---:|
| ESLint | PASS (`lint.log`) |
| TypeScript | PASS (`typecheck.log`) |
| Vitest + coverage | 21 file, 249/249 PASS (`vitest.log`) |
| pgTAP công tắc TẮT | 8 file, 205/205 PASS (`pgtap-off.log`) |
| pgTAP BẬT toàn bộ | 11 file, 376/376 PASS (`pgtap-on.log`) |
| Next.js production build | PASS, 79 trang (`build.log`) |

pgTAP chạy trên Postgres trắng tách biệt (`supabase db start`, cổng 586xx), không đụng stack 543xx.

## Kiểm tay bằng Playwright trên bản build

Script `playwright/logout-check.mjs` chạy trong `mcr.microsoft.com/playwright:v1.49.1-jammy` (Chromium
headless). Trình duyệt mở `http://127.0.0.1:<cổng>` qua bộ chuyển tiếp TCP trong container: cookie phiên
tạm của đăng nhập tổ chức có cờ `Secure` nên chỉ được nhận ở `127.0.0.1`/`localhost`. Cả hai lần chạy
dùng chung stack `eoffice-smoke-v120` (584xx, dữ liệu demo giả, `ORG_ACCOUNTS_ENABLED` bật bằng SQL).

| Kịch bản | Gói v1.2.0 (cổng 3600) | Bản sửa (cổng 3700) |
|---|---|---|
| 1. Sinh viên đăng xuất | Về `/login` sau 290 ms | Về `/login` sau 569 ms |
| 2. Tổ chức đăng xuất | Về **`/login`**; phiên cán bộ **không** kết thúc (`ended_at` NULL) | Về **`/admin/login`**; `ended_at` có giá trị; log `officerSessionEnded: true` |
| 3a. "Đổi cán bộ" rồi tải lại tab cũ cùng trình duyệt | HTTP 200 → `/login` | HTTP 200 → `/login` |
| 3b. Trình duyệt khác còn cookie của phiên đã thu hồi, mở `/`, `/login`, `/admin`, `/programs` | **HTTP 500 cả bốn trang**, cookie phiên vẫn còn | HTTP 200; trang đầu xóa cookie (còn 0), các trang cần đăng nhập chuyển về `/login` |

- Log: `playwright/v1.2.0-truoc-sua.log`, `playwright/sau-sua.log`, `playwright/sau-sua-auth-events.log`
  (các sự kiện `auth.logout`, `auth.session_cleared`; không có token, cookie hay MSSV đầy đủ).
- Ảnh: `playwright/*.png` (8 ảnh). Ảnh `v1.2.0-truoc-sua-3-cookie-phien-thu-hoi.png` là trang
  "Đã có lỗi xảy ra" của lỗi #85.
- `officer-sessions.log`: dòng `07:05:27 | NULL` là lần đăng xuất tổ chức trên v1.2.0; dòng `07:05:46`
  là lần đăng xuất trên bản sửa, `ended_at` có giá trị.

**Giới hạn:** headless Chromium **không** tái hiện được lỗi kẹt "Đang đăng xuất…" trên v1.2.0 (đăng xuất
xong sau 290 ms). Lỗi đã gặp trên Cốc Cốc thật ngày 13/11 (#84). Việc bỏ `Clear-Site-Data` dựa trên
giả thuyết mạnh nhất, chưa xác nhận trên trình duyệt. Dù nguyên nhân là gì, nút nay có timeout 8 giây
và luôn chuyển trang (test `logout-button.test.tsx`), nên không còn kẹt.
