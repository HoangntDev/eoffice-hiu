# Cấu hình, secret và dependency (TH2 – nhiệm vụ 3)

Issue #25, branch `refactor/25-externalize-config`. Thực hiện ngày 20/10/2026 (lấy bằng `date`). Bằng chứng nằm trong `docs/TH2/evidence/config/`.

## 1. Configuration Inventory

Ứng dụng là Next.js 16 và Supabase. Cấu hình đọc từ biến môi trường qua một file duy nhất là `src/lib/env.ts`. Khi chạy local, giá trị đặt trong `.env.local`; file này bị `.gitignore` loại khỏi repo. File mẫu `.env.example` chỉ chứa giá trị giả.

| Mục cấu hình | Trước khi tách | Sau khi tách | Nhạy cảm | Theo môi trường |
|---|---|---|---|---|
| URL API Supabase (`NEXT_PUBLIC_SUPABASE_URL`) | Biến môi trường. Đọc qua `env.ts`, riêng `src/proxy.ts` đọc thẳng `process.env` | Biến môi trường, chỉ đọc qua `env.ts` (`publicSupabaseEnv`, `optionalPublicSupabaseEnv`) | Không | Dev: `http://127.0.0.1:54321`. CI: giá trị giữ chỗ. Stack demo: `:55321` |
| Publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Như trên | Như trên | Thấp (công khai cho trình duyệt; quyền do RLS quyết định) | Mỗi stack Supabase một key |
| Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) | Biến môi trường, `env.ts` (`serverSupabaseEnv`) | Giữ nguyên, chỉ server | **Có** | Mỗi stack một key. CI dùng giá trị giữ chỗ, không cần secret thật |
| Pepper giới hạn tần suất (`AUTH_RATE_LIMIT_PEPPER`) | Biến môi trường, `env.ts` | Giữ nguyên, chỉ server | **Có** | Mỗi môi trường một chuỗi ngẫu nhiên (`openssl rand -hex 32`) |
| Origin của app (`NEXT_PUBLIC_APP_URL`) | Biến môi trường, mặc định `http://127.0.0.1:3000` | Giữ nguyên | Không | Dev: `127.0.0.1:3000`. Demo: `:3200` |
| **Logging level (`LOG_LEVEL`)** | `src/lib/log.ts` đọc thẳng `process.env`, không ghi trong tài liệu, luôn mặc định `info` | `env.ts` → `logLevel()`, có trong `.env.example` và README. Giá trị sai thì dùng mặc định | Không | Trống thì: **dev → `debug`, production → `info`, test → `warn`** |
| Cookie `Secure` (`NODE_ENV`) | `confirm-handler.ts` đọc thẳng `process.env.NODE_ENV` | `env.ts` → `isProduction()` | Không | Production: bật `Secure`. Dev: tắt (HTTP local) |
| Cổng chạy app (`PORT`) | Mặc định của Next (3000) | Giữ nguyên, ghi trong README | Không | Dev 3000; khi chạy song song thì đặt cổng khác |
| Chuỗi kết nối Postgres | Không nằm trong app. App chỉ gọi Supabase API; CLI tự quản cổng `54322` qua `supabase/config.toml` | Giữ nguyên | Có (mật khẩu DB local mặc định của CLI) | Local: theo `supabase/config.toml`. Stack demo: đổi `project_id` và cổng |
| Biến cho script seed demo (`DEMO_SUPABASE_URL`, `DEMO_SERVICE_ROLE_KEY`) | Biến môi trường, chỉ dùng cho `scripts/seed-demo.mjs`; không đọc `.env.local` | Giữ nguyên | Có | Chỉ dùng cho stack demo, script từ chối host không phải local |
| Giới hạn PDF kế hoạch (5 MB) | Hằng số `MAX_PLAN_PDF_BYTES` | Giữ là hằng số | Không | Giống nhau. Đây là quy tắc nghiệp vụ, đặt cùng chỗ với ràng buộc của Storage bucket |
| Thời hạn token QR (30 giây) | Trong RPC PostgreSQL (`supabase/migrations`) | Giữ trong DB | Không | Giống nhau. Đây là quy tắc nghiệp vụ đã chốt (kiểm theo giờ server) và có pgTAP kiểm tra |

Hai tham số cuối được cố ý giữ trong code hoặc DB. Lý do: đó là quy tắc nghiệp vụ có test kiểm tra (`CLAUDE.md`), không phải cấu hình theo môi trường. Nếu đưa ra biến môi trường thì có thể chạy lệch giữa các môi trường.

**Secret trên CI.** Workflow không cần secret thật. Job `build-test` dùng giá trị giữ chỗ để build. Job `pgtap` dựng Postgres local trong runner. Vì vậy chưa tạo mục nào ở Settings → Secrets and variables → Actions.

**Kiểm tra sau refactor** (`evidence/config/app-run-after-refactor.txt`):
- lint, typecheck: sạch.
- `npm test`: 12 file, 125 test PASS (có 6 test mới trong `tests/env-config.test.ts`).
- `npm run build`: thành công.
- Chạy `next start` với `.env.local`: `/`, `/login`, `/forms` trả 200; `/programs` khi chưa đăng nhập trả 307 về `/login`; đăng nhập sai PIN trả 401 `INVALID_CREDENTIALS`. Hành vi giống trước khi refactor.

## 2. Rà lịch sử secret

Log đầy đủ: `evidence/config/secret-scan.txt`. Lệnh chạy cho từng mẫu trên mọi nhánh (76 commit):

```
git log --all -p -S '<mẫu>' --format='%h %ad %s' --date=short
```

| Mẫu | Kết quả | Kết luận |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY=` | Chỉ có `replace-with-…` (`.env.example`) và biến shell `$DEMO_KEY`, `$SERVICE_ROLE_KEY` trong tài liệu | Không có giá trị thật |
| `AUTH_RATE_LIMIT_PEPPER=` | `replace-with-…` và `demo-local-pepper`. Giá trị thứ hai là giá trị cố ý dành cho stack demo local trong `docs/TH2/demo-data.md` | Không phải secret của môi trường thật |
| `service_role` | Tên role Postgres trong `grant … to service_role` và trong tài liệu | Không phải khóa |
| `eyJhbGciOi` (JWT), `Password=`, `password=`, `sk_test` | 0 kết quả | — |
| `sb_secret_`, `PRIVATE KEY`, `ghp_`, `AKIA`, `sk_live` | Chỉ xuất hiện trong chính lệnh grep được chép vào báo cáo TH1 | Không có khóa |
| File `.env*` từng commit | Chỉ `.env.example` | `.env.local` chưa từng vào repo |

Không có secret nào bị lộ, nên không cần đổi khóa.

## 3. Bảng kê dependency

Lệnh `npm ls --depth=0` liệt kê 26 dependency trực tiếp (12 runtime và 14 dev). Output đầy đủ ở `evidence/config/npm-ls-depth0.txt`. Bảng dưới gồm 10 dependency quan trọng:

| Tên | Phiên bản | Mục đích | Trực tiếp / bắc cầu | Ghi chú rủi ro |
|---|---|---|---|---|
| `next` | 16.3.8 | Framework web (App Router, Route Handlers, proxy) | Trực tiếp (runtime) | 16.3.6 có 6 advisory high (GHSA-3w37…, GHSA-cjq9… SSRF Image Optimization…). Đã nâng lên 16.3.8 (bản vá cùng nhánh 16.3). Bản mới nhất là 16.4.2; chưa lên minor mới để tránh thay đổi hành vi |
| `react`, `react-dom` | 19.2.8 | Thư viện giao diện | Trực tiếp | Mới nhất 19.3.1. Phải đi cùng phiên bản Next, nên chưa nâng riêng |
| `@supabase/supabase-js` | 2.117.2 | Client gọi Auth, PostgREST/RPC, Storage | Trực tiếp | Mới nhất 2.118.0. Không có cảnh báo bảo mật |
| `@supabase/ssr` | 0.12.7 | Phiên đăng nhập bằng cookie cho server/proxy | Trực tiếp | Vẫn là bản 0.x, API có thể đổi giữa các minor. Đã cố định phiên bản |
| `zod` | 4.6.5 | Kiểm tra dữ liệu vào (MSSV, PIN, form, API) | Trực tiếp | Mới nhất 4.6.7, không có cảnh báo |
| `qrcode` | 1.5.4 | Sinh ảnh QR điểm danh (UC-D) | Trực tiếp | Ít được cập nhật, nhưng đã là bản mới nhất và không có cảnh báo |
| `react-hook-form` + `@hookform/resolvers` | 7.89.0 / 5.9.1 | Khai báo cho form | Trực tiếp | **Khai báo nhưng `src/` chưa import.** Ghi nhận để dọn ở việc khác; PR này không gỡ để giữ đúng phạm vi |
| `typescript` | 5.9.3 | Kiểm tra kiểu (`npm run typecheck`) | Trực tiếp (dev) | Đã có TS 7, nhưng là major mới nên chưa nâng |
| `vitest` + `@vitest/coverage-v8` | 5.0.2 | Unit test, coverage, JUnit trên CI | Trực tiếp (dev) | Mới nhất 5.0.5, không có cảnh báo |
| `eslint` + `eslint-config-next` | 9.39.5 / 16.3.8 | Lint | Trực tiếp (dev) | `eslint-config-next` kéo theo chuỗi bắc cầu `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, có advisory high (DoS khi xử lý glob lồng sâu). Xem mục 4 |
| Postgres 17 (image của Supabase), Supabase CLI 2.117.0 | — | DB local, pgTAP | Công cụ ngoài npm | CLI có bản 2.121.0. CI cố định `2.117.0` giống máy local |

**Cố định phiên bản.** Trước đây 18 trong 26 dependency trực tiếp khai báo khoảng (`^5.9.1`, `^4`, `^19`…). Nay mọi dependency trực tiếp trong `package.json` ghi đúng phiên bản đang cài (lấy từ `npm ls`). Thêm `.npmrc` với `save-exact=true` để lần cài sau cũng ghi phiên bản cố định. Phiên bản bắc cầu vẫn do `package-lock.json` khóa, và CI dùng `npm ci`.

## 4. Kiểm tra lỗ hổng (`npm audit`)

| Thời điểm | Kết quả | Log |
|---|---|---|
| Trước | 7 high: `next` (6 advisory), `source-map-js` (bắc cầu) và chuỗi `eslint-config-next` → `braces` | `evidence/config/npm-audit-before.txt` |
| Sau | 5 high, chỉ còn chuỗi `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` | `evidence/config/npm-audit-after.txt` |

Quyết định xử lý:
1. `next` 16.3.6 → **16.3.8**: bản vá, đóng 6 advisory. Đã chạy lại lint, typecheck, test và build, rồi chạy lại app.
2. `source-map-js` 1.2.1 → 1.2.2 bằng `npm audit fix`. Đây là dependency bắc cầu, bản sửa không phá vỡ API.
3. Chuỗi `braces`: **chấp nhận rủi ro, ghi known issue.** Lý do:
   - Đây là công cụ lint chỉ chạy lúc phát triển và trên CI, không có trong bản build chạy cho người dùng.
   - Dữ liệu vào là glob do chính repo cấu hình, không phải dữ liệu từ người dùng.
   - Cách sửa duy nhất npm gợi ý là hạ `eslint-config-next` về 14.2.35. Bản này không tương thích Next 16.

   Sẽ xem lại khi `eslint-config-next` ra bản sửa.
