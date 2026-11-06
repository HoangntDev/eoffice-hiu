# Hướng dẫn triển khai gói phát hành

Áp dụng cho gói `hiu-youth-e-office-v<phiên bản>.zip`, đính kèm ở trang GitHub Release (ví dụ <https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0.0>).

## 1. Gói gồm những gì

| Thành phần | Mô tả |
|---|---|
| Mã nguồn tại tag | Lấy bằng `git archive` từ đúng commit được gắn tag: `src/`, `supabase/` (migrations, config, mẫu email), `scripts/`, `data/`, `docs/`, `package.json`, `package-lock.json`, `.env.example` |
| `.next/` | Bản build production (`npm run build`) tạo từ đúng commit đó. Đã bỏ `.next/cache` |
| `BUILD-INFO.txt` | Tag, commit, ngày build, phiên bản Node/npm dùng để build, SHA-256 của gói |
| `HUONG-DAN-TRIEN-KHAI.md` | Bản sao của tài liệu này |

Gói **không** chứa `node_modules`, `.env.local`, secret hay dữ liệu cá nhân.

**Build một lần, cấu hình lúc chạy.** Gói được build với giá trị giữ chỗ. Ứng dụng không có Supabase client phía trình duyệt, và mọi biến, kể cả `NEXT_PUBLIC_*`, được đọc lúc chạy qua `src/lib/env.ts`. Vì vậy cùng một gói dùng được cho mọi môi trường: chỉ cần đặt `.env.local` phù hợp, **không phải build lại**. Nếu sau này thêm code đọc `process.env.NEXT_PUBLIC_*` ở component phía trình duyệt, điều này sẽ không còn đúng. Khi đó phải build lại theo từng môi trường bằng `npm run build`.

## 2. Yêu cầu máy đích

- Node.js 24 và npm 12.
- Docker đang chạy.
- Supabase CLI ≥ 2.117, dùng cho DB local. Môi trường dùng Supabase cloud cần được phê duyệt riêng; xem `docs/operations/`.
- Cổng trống: 3000 cho web (đổi được bằng `PORT`) và 543xx cho Supabase (đổi được trong `supabase/config.toml`).

## 3. Cài đặt

```bash
# 1. Giải nén vào thư mục mới và kiểm tra checksum (giá trị ghi ở trang Release)
mkdir eoffice-v1.0.0 && cd eoffice-v1.0.0
unzip ../hiu-youth-e-office-v1.0.0.zip
shasum -a 256 ../hiu-youth-e-office-v1.0.0.zip

# 2. Cài dependency đúng theo package-lock.json
npm ci

# 3. Dựng database: Supabase local áp toàn bộ supabase/migrations
supabase start
#    Máy đã có stack khác ở 543xx? Đổi project_id và cổng trước khi start:
#    sed -i '' -e 's/^project_id = .*/project_id = "eoffice-v100"/' -e 's/= 543\([0-9][0-9]\)$/= 563\1/' \
#              -e 's/^inspector_port = 8083/inspector_port = 8283/' supabase/config.toml

# 4. Cấu hình
cp .env.example .env.local
supabase status -o env      # chép API_URL, PUBLISHABLE_KEY, SERVICE_ROLE_KEY vào .env.local
openssl rand -hex 32        # giá trị AUTH_RATE_LIMIT_PEPPER
#    NEXT_PUBLIC_APP_URL = địa chỉ người dùng mở web, ví dụ http://localhost:3000

# 5. Chạy bản build có sẵn (không cần npm run build)
npm start                   # hoặc: PORT=3100 npm start
```

Bảng biến môi trường xem ở README, mục "Biến môi trường".

## 4. Khởi tạo dữ liệu

- **Môi trường thật:**
  1. Tạo tài khoản đầu tiên tại `/register`.
  2. Chạy `npm run admin:bootstrap -- --user-id <UUID> --confirm`.
  3. Import danh mục: `npm run catalog:import -- <file.csv>`, chạy thử trước rồi thêm `--apply`.

  Chi tiết các bước ở README.
- **Môi trường demo hoặc kiểm thử:** dùng `npm run demo:seed -- --confirm-demo` theo `docs/TH2/demo-data.md`. Script chỉ chạy trên DB local còn trống.

## 5. Kiểm tra sau triển khai

Chạy checklist [`docs/testing/smoke-test.md`](../testing/smoke-test.md), rồi lưu kết quả (log, ảnh) vào thư mục bằng chứng của đợt phát hành.

## 6. Rollback – quay lại phiên bản trước

Dùng khi bản vừa triển khai gặp lỗi nghiêm trọng mà chưa sửa nhanh được. Rollback chỉ đổi mã chạy; dữ liệu giữ nguyên.

**Điều kiện:** hai phiên bản phải dùng cùng lược đồ database. Kiểm tra trước khi quyết định:

```bash
git diff --stat <bản cũ> <bản mới> -- supabase/   # rỗng: không đổi schema, rollback được ngay
```

Nếu có migration mới, migration đã áp không tự gỡ được: phải phục hồi DB về bản sao lưu chụp **trước khi nâng cấp** (`scripts/restore.sh <stack> <bản sao lưu>`, xem `docs/runbooks/backup-restore.md`), và mọi dữ liệu ghi sau thời điểm đó sẽ mất. Vì vậy luôn chạy `scripts/backup.sh <stack>` trước khi nâng cấp.

| Từ → về | Schema | Ghi chú |
|---|---|---|
| v1.0.1 → v1.0.0 | Không đổi (migration cuối của cả hai là `202610150003`) | Rollback không cần đụng DB. v1.0.0 không có `/api/health`, không ghi log ra file |

**Các bước** (đã diễn tập ngày 06/11/2026, số liệu ở `docs/TH3/evidence/rollback/`):

1. **Quyết định và sao lưu:** kiểm schema như trên, rồi `scripts/backup.sh <stack>`. Diễn tập: 1,2 giây.
2. **Dừng bản mới:** `kill -TERM $(lsof -t -iTCP:<cổng> -sTCP:LISTEN)` (hoặc Ctrl+C ở cửa sổ chạy `npm start`). Diễn tập: 0,2 giây.
3. **Cài bản cũ vào thư mục mới**, không ghi đè thư mục bản mới (để còn quay lại):

   ```bash
   mkdir -p eoffice-<bản cũ>/dl eoffice-<bản cũ>/app && cd eoffice-<bản cũ>/dl
   gh release download <bản cũ> --repo HoangntDev/eoffice-hiu
   shasum -a 256 -c hiu-youth-e-office-<bản cũ>.zip.sha256
   cd ../app && unzip -q ../dl/hiu-youth-e-office-<bản cũ>.zip && npm ci
   cp <thư mục bản mới>/.env.local .env.local      # cùng stack, cùng cổng
   PORT=<cổng> npm start
   ```

   Diễn tập (v1.0.0): 19,3 giây, trong đó `npm ci` 14 giây vì máy đã có sẵn cache npm; máy mới sẽ lâu hơn.
4. **Smoke test** theo `docs/testing/smoke-test.md`. Diễn tập: 8/8 PASS, 11,9 giây.

Tổng từ lúc quyết định rollback tới smoke xong trong diễn tập: **32,6 giây**, nằm trong RTO 30 phút của runbook. Sau khi rollback, ghi lại lý do và mở issue cho lỗi của bản mới; chỉ triển khai lại khi đã có bản sửa.

## 7. Đóng gói một phiên bản (dành cho người phát hành)

Dùng `scripts/package-release.sh`, không ghép gói bằng tay. Script được thêm sau sự cố đóng gói v1.0.1: gói tải lên lần đầu bị `zip` bỏ mất 2 symlink `.next/node_modules/winston-*` nên `npm start` báo `Cannot find module` (xem `docs/TH3/INC-01-ThieuCauHinh/incident-report.md`).

```bash
git tag -a v1.0.2 <commit> -m "…" && git push origin v1.0.2   # tag annotated, sau khi CI trên main xanh
scripts/package-release.sh 1.0.2
```

Script làm lần lượt:

1. Kiểm tra tag `v<version>` tồn tại và là tag annotated; tạo worktree tạm tại tag, kiểm tra không có thay đổi chưa commit và `package.json` đúng version.
2. `npm ci`, `npm run build` với `NODE_ENV=production` và biến giữ chỗ.
3. Ghép gói: mã nguồn tại tag (`git archive`), bỏ báo cáo môn học; `.next/` không có `.next/cache`; `BUILD-INFO.txt`; `HUONG-DAN-TRIEN-KHAI.md`. Nén bằng `zip -y` để **giữ nguyên symlink**, tạo `.sha256`.
4. **Tự kiểm tra:** giải nén vào thư mục tạm, chặn gói có file `.env`, `npm ci`, kiểm tra symlink trong `.next/node_modules` trỏ tới module đã cài, khởi động ở cổng `VERIFY_PORT` (mặc định 3990) với biến giữ chỗ (không gọi Supabase thật), gọi `/api/health`: phải có `"app":"ok"` và đúng `"version"` (`db: "error"` là bình thường vì không có DB).
5. Đạt thì chuyển gói vào `dist/` (nằm trong `.gitignore`) và in lệnh `gh release …` để người phát hành tự chạy. Hỏng thì dừng với mã khác 0, không có gì trong `dist/`.

Kiểm tra lại một gói có sẵn (ví dụ gói tải từ Release): `scripts/package-release.sh --verify <file.zip> <version>`. Tự kiểm tra cần `/api/health`, nên chỉ dùng được với gói từ v1.0.1 trở đi.

