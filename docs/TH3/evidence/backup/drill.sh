#!/usr/bin/env bash
# Diễn tập sao lưu/phục hồi trên stack tách biệt eoffice-v100 (dữ liệu demo giả). Chạy từ thư mục repo:
#   SMOKE_MSSV=2201110203 SMOKE_NAME="Phạm Quốc Bảo" PW=<thư mục smoke-ui.mjs> bash drill.sh <thư mục bằng chứng>
# PW: thư mục chứa smoke-ui.mjs (script Playwright bước 5–8 của TH2, đọc BASE từ biến môi trường).
set -euo pipefail
STACK=eoffice-v100
DB=supabase_db_$STACK
ST=supabase_storage_$STACK
OUT="$1"           # thư mục ghi bằng chứng
RUN=${RUN:-~/Developer/eoffice-th3-run}   # worktree chạy web (cổng 3400), .env.local trỏ vào stack eoffice-v100
PORT=3400
mkdir -p "$OUT"
q() { docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -P pager=off "$@"; }
ts() { date +%H:%M:%S; }
ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000'; }
TIMES="$OUT/timings.tsv"; echo -e "buoc\tbat_dau\tket_thuc\tms" > "$TIMES"
step() { echo -e "$1\t$2\t$(ts)\t$(( $(ms) - $3 ))" >> "$TIMES"; }

snapshot() { # $1 = tên tệp
  {
    echo "### $(date '+%Y-%m-%d %H:%M:%S %z') – $1"
    echo "## Số bản ghi các bảng chính"
    q -c "select 'auth.users' bang, count(*) from auth.users union all
          select 'accounts', count(*) from public.accounts union all
          select 'student_profiles', count(*) from public.student_profiles union all
          select 'union_applications', count(*) from public.union_applications union all
          select 'event_programs', count(*) from public.event_programs union all
          select 'event_program_documents', count(*) from public.event_program_documents union all
          select 'program_registrations', count(*) from public.program_registrations union all
          select 'program_attendance_records', count(*) from public.program_attendance_records union all
          select 'forms', count(*) from public.forms union all
          select 'form_responses', count(*) from public.form_responses union all
          select 'audit_events', count(*) from public.audit_events union all
          select 'storage.objects', count(*) from storage.objects"
    echo "## Bản ghi mẫu: kế hoạch chương trình"
    q -c "select left(id::text, 8) id, status, left(title, 55) title, (select count(*) from public.program_registrations r where r.program_id = p.id) dang_ky
          from public.event_programs p order by created_at"
    echo "## Đăng ký theo chương trình và trạng thái"
    q -c "select left(p.title, 40) chuong_trinh, r.status, count(*) from public.program_registrations r join public.event_programs p on p.id = r.program_id group by 1, 2 order by 1, 2"
    echo "## Bản ghi mẫu: hồ sơ Đoàn viên"
    q -c "select left(id::text, 8) id, cycle_key, status from public.union_applications order by created_at"
    echo "## File PDF trong Storage (sha256 nội dung)"
    docker exec "$ST" sh -c 'cd /mnt && find . -type f | sort | while read f; do printf "%s  %s\n" "$(sha256sum "$f" | cut -c1-16)" "$(echo "$f" | cut -c1-90)"; done'
  } > "$OUT/$1" 2>&1
}

T0=$(ms)
echo "== 1. Số liệu trước ($(ts))"
B=$(ts); T=$(ms); snapshot 1-truoc.txt; step "1. Ghi số liệu trước" "$B" "$T"

echo "== 2. Sao lưu ($(ts))"
B=$(ts); T=$(ms); scripts/backup.sh "$STACK" 2>&1 | tee "$OUT/2-backup.log"; step "2. Sao lưu (scripts/backup.sh)" "$B" "$T"
NAME=$(tail -1 "$OUT/2-backup.log")

echo "== 3. Gây hỏng dữ liệu ($(ts))"
B=$(ts); T=$(ms)
BLOOD=$(q -tAc "select id from public.event_programs where title like 'Ngày hội Hiến máu%'")
{
  echo "\$ (SQL) từ chối nhầm hàng loạt đăng ký của chương trình Hiến máu, sửa sai tên và địa điểm 2 kế hoạch, xóa nhầm 1 hồ sơ Đoàn viên đang chờ xét"
  q <<SQL
begin;
update public.program_registrations set status = 'rejected', quota_id = null, decided_at = coalesce(decided_at, now()),
       decision_reason = 'Từ chối nhầm hàng loạt (diễn tập)'
 where program_id = '$BLOOD' and status <> 'rejected';
update public.event_programs set title = 'SAI DỮ LIỆU – ' || left(title, 20), location = '???'
 where title like 'Workshop%' or title like 'Chiến dịch%';
delete from public.union_applications x
 where x.status = 'submitted'
   and not exists (select 1 from public.membership_reviews m where m.application_id = x.id)
   and not exists (select 1 from public.paper_book_events p where p.application_id = x.id)
   and not exists (select 1 from public.union_memberships u where u.recognized_application_id = x.id);
commit;
SQL
  echo "\$ (Storage) xóa 1 file PDF, ghi đè nội dung 1 file PDF khác"
  docker exec "$ST" sh -c 'set -e; cd /mnt; files=$(find . -type f | sort); one=$(echo "$files" | sed -n 1p); two=$(echo "$files" | sed -n 2p); rm "$one"; echo "hong" > "$two"; echo "xóa: $one"; echo "ghi đè: $two"'
} > "$OUT/3-gay-hong.log" 2>&1
cat "$OUT/3-gay-hong.log"
step "3. Gây hỏng dữ liệu" "$B" "$T"
snapshot 3-sau-khi-hong.txt

echo "== 4. Dừng web ($(ts))"
B=$(ts); T=$(ms); TR=$T
kill -TERM "$(lsof -t -iTCP:$PORT -sTCP:LISTEN)"; while lsof -t -iTCP:$PORT -sTCP:LISTEN >/dev/null; do sleep 0.2; done
step "4. Dừng web" "$B" "$T"

echo "== 5. Phục hồi ($(ts))"
B=$(ts); T=$(ms); scripts/restore.sh "$STACK" "$NAME" 2>&1 | tee "$OUT/5-restore.log"; step "5. Phục hồi (scripts/restore.sh)" "$B" "$T"

echo "== 6. Khởi động web ($(ts))"
B=$(ts); T=$(ms)
( cd "$RUN" && PORT=$PORT nohup npm start > "$OUT/../web-$PORT.out.tmp" 2>&1 < /dev/null & ) >/dev/null 2>&1
until curl -sf -o /dev/null "http://localhost:$PORT/api/health"; do sleep 0.3; done
step "6. Khởi động web đến khi /api/health = 200" "$B" "$T"

echo "== 7. So sánh ($(ts))"
B=$(ts); T=$(ms); snapshot 7-sau-phuc-hoi.txt
diff <(sed 1d "$OUT/1-truoc.txt") <(sed 1d "$OUT/7-sau-phuc-hoi.txt") > "$OUT/7-diff-truoc-sau.txt" && echo "KHỚP: số liệu sau phục hồi giống hệt trước khi gây hỏng" | tee -a "$OUT/7-diff-truoc-sau.txt" || { echo "KHÁC (xem 7-diff-truoc-sau.txt)"; }
step "7. So sánh số liệu trước/sau" "$B" "$T"

echo "== 8. Smoke test ($(ts))"
B=$(ts); T=$(ms)
BASE=http://localhost:$PORT
{
  echo "\$ curl $BASE/ → $(curl -s -o /dev/null -w '%{http_code}' $BASE/)"
  echo "\$ curl $BASE/forms → $(curl -s -o /dev/null -w '%{http_code}' $BASE/forms)"
  echo "\$ curl $BASE/programs → $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $BASE/programs)"
  echo "\$ curl $BASE/api/health → $(curl -s $BASE/api/health)"
} > "$OUT/8-smoke.log"
docker run --rm --add-host=host.docker.internal:host-gateway -e BASE=http://host.docker.internal:$PORT -e SMOKE_MSSV -e SMOKE_NAME \
  -v "$PW:/out" -w /out mcr.microsoft.com/playwright:v1.49.1-jammy \
  sh -c 'npm i --silent --no-audit --no-fund playwright@1.49.1 >/dev/null 2>&1 && node smoke-ui.mjs "$SMOKE_MSSV" "$SMOKE_NAME"' >> "$OUT/8-smoke.log" 2>&1
cat "$OUT/8-smoke.log"
step "8. Smoke test (bước 2–4 curl, 5–8 Playwright)" "$B" "$T"
echo -e "RTO đo được (dừng web → smoke xong)\t\t\t$(( $(ms) - TR ))" >> "$TIMES"
echo -e "Tổng diễn tập\t\t\t$(( $(ms) - T0 ))" >> "$TIMES"
column -t -s $'\t' "$TIMES"
