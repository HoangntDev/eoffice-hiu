# Dựng DB demo sạch trên stack Supabase tách biệt

Mục đích: có dữ liệu tiếng Việt gọn gàng để chụp màn hình và trình bày, **không đụng tới DB local đang dùng** (stack `hiu-youth-e-office`, cổng 543xx).

Stack demo dùng `project_id = "hiu-eoffice-demo"` và các cổng 553xx, nên chạy song song được với stack chính. Lệnh `db reset` chỉ được chạy trên stack demo, luôn kèm `--workdir` của demo.

## 1. Tạo thư mục stack demo (một lần)

Chạy ở thư mục gốc repo:

```bash
DEMO=~/Developer/eoffice-demo
mkdir -p "$DEMO" && cp -R supabase "$DEMO"/
rm -rf "$DEMO"/supabase/.temp "$DEMO"/supabase/.branches
sed -i '' -e 's/^project_id = "hiu-youth-e-office"/project_id = "hiu-eoffice-demo"/' \
          -e 's/= 543\([0-9][0-9]\)$/= 553\1/' \
          -e 's/^inspector_port = 8083/inspector_port = 8183/' "$DEMO"/supabase/config.toml
grep -nE '^project_id|^\s*port = ' "$DEMO"/supabase/config.toml   # phải thấy hiu-eoffice-demo và 553xx
```

## 2. Khởi động stack demo

Lệnh này áp toàn bộ migration của repo lên DB mới:

```bash
supabase start --workdir "$DEMO" -x edge-runtime,imgproxy,logflare,vector
supabase status --workdir "$DEMO" -o env | grep -E '^(API_URL|PUBLISHABLE_KEY|SERVICE_ROLE_KEY)='
```

## 3. Nạp danh mục học vụ và dữ liệu demo

```bash
DEMO_KEY=$(supabase status --workdir "$DEMO" -o env | grep ^SERVICE_ROLE_KEY= | cut -d'"' -f2)

# Danh mục Khoa/Ngành/Lớp từ file CSV của đơn vị.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=$DEMO_KEY \
  npm run catalog:import -- "data/DSN LOPWS - Sheet1 (1).csv" --apply

# Dữ liệu demo.
DEMO_SUPABASE_URL=http://127.0.0.1:55321 DEMO_SERVICE_ROLE_KEY=$DEMO_KEY \
  npm run demo:seed -- --confirm-demo
```

`scripts/seed-demo.mjs` từ chối chạy khi:

- thiếu cờ `--confirm-demo`;
- URL không phải Supabase local;
- DB đã có tài khoản, tức là DB đang dùng hoặc DB đã seed rồi.

Script không đọc `.env.local`, nên không thể ghi nhầm vào stack chính.

## 4. Chạy web với DB demo

`NEXT_PUBLIC_*` được nhúng lúc build, nên dùng một bản build riêng trỏ vào stack demo:

```bash
git worktree add ../eoffice-web-demo HEAD && cd ../eoffice-web-demo && npm ci
DEMO_PK=$(supabase status --workdir "$DEMO" -o env | grep ^PUBLISHABLE_KEY= | cut -d'"' -f2)
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$DEMO_PK
SUPABASE_SERVICE_ROLE_KEY=$DEMO_KEY
AUTH_RATE_LIMIT_PEPPER=demo-local-pepper
NEXT_PUBLIC_APP_URL=http://localhost:3200
EOF
npm run build && npx next start -p 3200   # mở http://localhost:3200
```

## 5. Tài khoản demo (PIN chung `123456`)

| MSSV | Họ tên | Vai trò / tình huống |
|---|---|---|
| 2211110101 | Nguyễn Văn An | SV Khoa CNKT. Đoàn viên đã công nhận. Đã được xác nhận ở 3 chương trình. |
| 2211110102 | Võ Thị Bích Ngọc | SV Khoa CNKT. Hồ sơ Đoàn viên đã nộp, chờ xét. Một đăng ký bị từ chối, có lý do. |
| 2211110103 | Huỳnh Gia Hân | SV Khoa CNKT. Workshop CV báo hết chỗ. Mùa hè xanh đang chờ BTC duyệt. |
| 2241110104 | Đặng Hoàng Phúc | SV Khoa Dược. Workshop CV báo không thuộc đối tượng. Hồ sơ Đoàn viên cần bổ sung. |
| 2201110201 | Lê Minh Quân | Bí thư Đoàn Khoa CNKT (`faculty_manager`). Có 1 kế hoạch chờ xét và 1 đăng ký chờ duyệt. |
| 2201110202 | Trần Thị Mai | Văn phòng Đoàn – Hội (`office`). Có 1 kế hoạch và 2 hồ sơ Đoàn viên chờ xử lý. |
| 2201110203 | Phạm Quốc Bảo | Quản trị Đoàn Trường (`school_admin`). |

Dữ liệu gồm:

- **4 kế hoạch chương trình:** 3 đã chấp thuận (một mở đăng ký, một đã đủ chỗ, một đã đóng và cần xét duyệt) và 1 đang chờ Văn phòng xét.
- **3 biểu mẫu:** 2 đang mở, 1 đã đóng.
- **4 hồ sơ Đoàn viên:** đã công nhận, đã nộp, CTV đã đề xuất, cần bổ sung.

Mọi họ tên, MSSV, CCCD và số điện thoại đều là dữ liệu giả.

## 6. Làm lại từ đầu hoặc dừng

```bash
supabase db reset --workdir "$DEMO"            # CHỈ stack demo; sau đó chạy lại bước 3
supabase stop --workdir "$DEMO" --no-backup    # dừng và xóa dữ liệu demo
```
