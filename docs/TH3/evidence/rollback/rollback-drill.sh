#!/usr/bin/env bash
# Diễn tập rollback v1.0.1 → v1.0.0 trên stack tách biệt eoffice-v100 (dữ liệu demo giả), cổng 3500.
# Dùng: bash rollback-drill.sh <thư mục bằng chứng> <thư mục smoke-ui.mjs>
set -uo pipefail
OUT="$1"; PW="$2"; mkdir -p "$OUT"
REPO=~/Developer/hiu-youth-e-office
NEW=~/Developer/eoffice-smoke-v1.0.1/app          # bản đang chạy (gói v1.0.1 tải từ Release)
OLD=~/Developer/eoffice-rollback-v1.0.0           # thư mục mới cho gói v1.0.0
PORT=3500; B=http://localhost:$PORT
ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000'; }
ts() { date +%H:%M:%S; }
TIMES="$OUT/timings.tsv"; echo -e "buoc\tbat_dau\tket_thuc\tms" > "$TIMES"
step() { echo -e "$1\t$2\t$(ts)\t$(( $(ms) - $3 ))" >> "$TIMES"; }
h() { printf '\n\033[1m== %s (%s)\033[0m\n' "$1" "$(ts)"; }

h "0. Trạng thái trước: v1.0.1 đang chạy"
curl -s -w "  HTTP %{http_code}\n" $B/api/health
T0=$(ms)
h "SỰ CỐ GIẢ ĐỊNH: v1.0.1 vừa phát hành gặp lỗi nghiêm trọng → quyết định rollback về v1.0.0"

h "1. Quyết định rollback: kiểm schema + sao lưu"
B1=$(ts); T=$(ms)
( cd "$REPO" && echo '$ git diff --stat v1.0.0 v1.0.1 -- supabase/' && git diff --stat v1.0.0 v1.0.1 -- supabase/ && echo "(rỗng: không đổi schema → rollback không cần gỡ migration)" )
echo '$ scripts/backup.sh eoffice-v100'; ( cd "$REPO" && scripts/backup.sh eoffice-v100 2>&1 | sed "s#$REPO#<repo>#g" | tail -2 )
step "1. Quyết định rollback (kiểm schema, sao lưu)" "$B1" "$T"; TR=$T

h "2. Dừng bản mới v1.0.1"
B1=$(ts); T=$(ms)
kill -TERM "$(lsof -t -iTCP:$PORT -sTCP:LISTEN)"; while lsof -t -iTCP:$PORT -sTCP:LISTEN >/dev/null; do sleep 0.2; done
echo "cổng $PORT đã trống"; grep -h '"app.stop"' "$NEW"/logs/app-*.log | tail -1 | cut -c1-160
step "2. Dừng bản mới v1.0.1" "$B1" "$T"

h "3. Cài bản cũ v1.0.0 từ Release"
B1=$(ts); T=$(ms)
mkdir -p "$OLD/dl" "$OLD/app"
( cd "$OLD/dl" && gh release download v1.0.0 --repo HoangntDev/eoffice-hiu --clobber && shasum -a 256 -c hiu-youth-e-office-v1.0.0.zip.sha256 ) || { echo "TẢI/CHECKSUM LỖI"; exit 1; }
( cd "$OLD/app" && unzip -q ../dl/hiu-youth-e-office-v1.0.0.zip && head -3 BUILD-INFO.txt && npm ci 2>&1 | grep -E "added|audit" | head -1 )
cp "$NEW/.env.local" "$OLD/app/.env.local"; chmod 600 "$OLD/app/.env.local"; echo "dùng lại .env.local (cùng stack, cùng cổng)"
( cd "$OLD/app" && PORT=$PORT nohup npm start > "$OUT/v1.0.0-npm-start.log" 2>&1 < /dev/null & ) >/dev/null 2>&1
until [ "$(curl -s -o /dev/null -w '%{http_code}' $B/)" = 200 ]; do sleep 0.3; done
echo "v1.0.0 trả lời: / → 200; /api/health → $(curl -s -o /dev/null -w '%{http_code}' $B/api/health) (v1.0.0 chưa có health check)"
step "3. Cài bản cũ v1.0.0 (tải, checksum, giải nén, npm ci, khởi động)" "$B1" "$T"

h "4. Smoke test 8 bước trên v1.0.0"
B1=$(ts); T=$(ms)
{
  echo "# Bước 1: npm start"; grep -v "npm notice" "$OUT/v1.0.0-npm-start.log"
  echo "# Bước 2: \$BASE/ → $(curl -s -o /dev/null -w '%{http_code}' $B/)"
  echo "# Bước 3: supabase status: $(cd ~/Developer/eoffice-smoke-v1.0.0/app && supabase status 2>/dev/null | grep -c running) dịch vụ running; /forms → $(curl -s -o /tmp/rb-forms.html -w '%{http_code}' $B/forms), thấy biểu mẫu demo: $(grep -o 'Khảo sát nhu cầu' /tmp/rb-forms.html | wc -l | tr -d ' ') lần"
  echo "# Bước 4: \$BASE/programs → $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $B/programs)"
  echo "# Bước 5–8 (Playwright, tài khoản demo 2201110203)"
  docker run --rm --add-host=host.docker.internal:host-gateway -e BASE=http://host.docker.internal:$PORT \
    -v "$PW:/out" -w /out mcr.microsoft.com/playwright:v1.49.1-jammy \
    sh -c 'npm i --silent --no-audit --no-fund playwright@1.49.1 >/dev/null 2>&1 && node smoke-ui.mjs 2201110203 "Phạm Quốc Bảo"' 2>&1
} | tee "$OUT/smoke.log" | cut -c1-150
step "4. Smoke test 8 bước" "$B1" "$T"
echo -e "Từ quyết định rollback tới smoke xong\t\t\t$(( $(ms) - TR ))" >> "$TIMES"

h "Bảng thời gian"
column -t -s $'\t' "$TIMES"
echo "PASS: $(grep -c PASS "$OUT/smoke.log")/4 bước Playwright; FAIL: $(grep -c FAIL "$OUT/smoke.log")"
