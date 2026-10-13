#!/usr/bin/env bash
# UC7: kiểm thử tranh chấp suất cuối với nhiều phiên Postgres đồng thời (pgTAP chạy một phiên nên không thay được).
# Ghi dữ liệu thật (commit) → CHỈ chạy trên stack Supabase local tách biệt, không chạy trên DB đang dùng.
#
#   scripts/race-program-registration.sh <db-container>     # ví dụ: supabase_db_uc7-race
set -euo pipefail

CONTAINER="${1:-}"
if [[ -z "$CONTAINER" ]]; then
  echo "Cách dùng: $0 <tên container DB của stack tách biệt>" >&2; exit 2
fi
if [[ "$CONTAINER" == "supabase_db_hiu-youth-e-office" ]]; then
  echo "Từ chối: đây là DB local chính. Dựng stack tách biệt (project_id khác) rồi chạy lại." >&2; exit 2
fi

psql_run() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

U() { printf 'e7000000-0000-4000-8000-%012d' "$1"; }
P_FCFS=a7000000-0000-4000-8000-0000000000f1
P_DUP=a7000000-0000-4000-8000-0000000000f2
P_APPROVAL=a7000000-0000-4000-8000-0000000000f3
STUDENTS=20

# ── Fixtures: 2 BTC cùng Khoa, 20 sinh viên, 3 chương trình đã duyệt ─────────
{
  echo "begin;"
  echo "insert into public.faculties (id, current_code, current_name) values ('e7000000-0000-4000-8000-00000000000a', 'RACE_KHOA', 'Khoa Race');"
  for i in 1 2 $(seq 101 $((100 + STUDENTS))); do
    echo "insert into auth.users (id, email) values ('$(U "$i")', 'race-$i@test.local');"
    echo "insert into public.accounts (user_id, student_code, status) values ('$(U "$i")', '$(printf '2075%06d' "$i")', 'active');"
  done
  for i in 1 2; do
    echo "insert into public.role_grants (user_id, role_code, organization_id, reason) select '$(U "$i")', 'faculty_manager', id, 'race' from public.organization_units where faculty_id = 'e7000000-0000-4000-8000-00000000000a' and unit_type = 'faculty_union';"
  done
  for p in "$P_FCFS" "$P_DUP" "$P_APPROVAL"; do
    echo "insert into public.event_programs (id, owner_org_id, faculty_id, title, starts_at, ends_at, status, created_by, decided_at)
          select '$p', id, 'e7000000-0000-4000-8000-00000000000a', 'Race $p', now() + interval '1 day', now() + interval '2 days',
                 'approved', '$(U 1)', now()
          from public.organization_units where faculty_id = 'e7000000-0000-4000-8000-00000000000a' and unit_type = 'faculty_union';"
  done
  echo "select set_config('request.jwt.claims', json_build_object('sub', '$(U 1)', 'role', 'authenticated')::text, true);"
  echo "set local role authenticated;"
  echo "select public.save_program_registration_settings('$P_FCFS', '{\"type\":\"hiu_student\"}', 5, false, null, null, null, null, '[]');"
  echo "select public.save_program_registration_settings('$P_DUP', '{\"type\":\"hiu_student\"}', null, false, null, null, null, null, '[]');"
  echo "select public.save_program_registration_settings('$P_APPROVAL', '{\"type\":\"hiu_student\"}', 1, true, null, null, null, null, '[]');"
  for p in "$P_FCFS" "$P_DUP" "$P_APPROVAL"; do echo "select public.set_program_registration_status('$p', 'open');"; done
  echo "commit;"
} | psql_run >/dev/null

as_user() { # $1 user index, $2 sql, $3 giây giữ transaction sau lệnh (mặc định 0)
  printf "begin;
select set_config('request.jwt.claims', json_build_object('sub', '%s', 'role', 'authenticated')::text, true);
set local role authenticated;
%s;
select pg_sleep(%s);
commit;\n" "$(U "$1")" "$2" "${3:-0}" | docker exec -i "$CONTAINER" psql -U postgres -d postgres -qAt 2>&1 | grep -E 'accepted|pending|rejected|ERROR' | head -1
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fail=0
check() { if [[ "$2" == "$3" ]]; then echo "PASS  $1 ($2)"; else echo "FAIL  $1: mong đợi $3, thực tế $2"; fail=1; fi; }
count() { psql_run -c "$1"; }

# ── 1. 20 sinh viên cùng lúc tranh 5 chỗ (nhận theo thứ tự) ──────────────────
for i in $(seq 101 $((100 + STUDENTS))); do
  as_user "$i" "select public.register_for_program('$P_FCFS', '[]', null)->>'status'" 0.2 > "$TMP/fcfs-$i" &
done
wait
check "20 phiên đồng thời, 5 chỗ: số được xác nhận" \
  "$(count "select count(*) from public.program_registrations where program_id = '$P_FCFS' and status = 'accepted'")" 5
check "20 phiên đồng thời, 5 chỗ: số bị chặn REGISTRATION_FULL" "$(cat "$TMP"/fcfs-* | grep -c REGISTRATION_FULL)" 15

# ── 2. Một sinh viên gửi 5 lần đồng thời ─────────────────────────────────────
for n in 1 2 3 4 5; do
  as_user 101 "select public.register_for_program('$P_DUP', '[]', null)->>'status'" 0.2 > "$TMP/dup-$n" &
done
wait
check "5 lần gửi đồng thời của cùng người: số bản ghi" \
  "$(count "select count(*) from public.program_registrations where program_id = '$P_DUP'")" 1
check "5 lần gửi đồng thời: số lần bị chặn ALREADY_REGISTERED" "$(cat "$TMP"/dup-* | grep -c ALREADY_REGISTERED)" 4

# ── 3. Hai BTC duyệt hai người khác nhau cho suất cuối cùng lúc ──────────────
as_user 101 "select public.register_for_program('$P_APPROVAL', '[]', null)->>'status'" >/dev/null
as_user 102 "select public.register_for_program('$P_APPROVAL', '[]', null)->>'status'" >/dev/null
R1=$(count "select id from public.program_registrations where program_id = '$P_APPROVAL' and user_id = '$(U 101)'")
R2=$(count "select id from public.program_registrations where program_id = '$P_APPROVAL' and user_id = '$(U 102)'")
# BTC 1 duyệt rồi giữ transaction 2 giây; BTC 2 duyệt trong lúc đó phải chờ khóa rồi nhận QUOTA_FULL.
as_user 1 "select public.decide_program_registration('$R1', 'approve', null)" 2 > "$TMP/appr-1" &
sleep 0.5
start=$(date +%s)
as_user 2 "select public.decide_program_registration('$R2', 'approve', null)" > "$TMP/appr-2"
waited=$(( $(date +%s) - start ))
wait
check "Hai BTC duyệt đồng thời, 1 chỗ: số được duyệt" \
  "$(count "select count(*) from public.program_registrations where program_id = '$P_APPROVAL' and status = 'accepted'")" 1
check "BTC thứ hai nhận QUOTA_FULL" "$(grep -c QUOTA_FULL "$TMP/appr-2")" 1
check "BTC thứ hai phải chờ khóa (≥1 giây)" "$([[ $waited -ge 1 ]] && echo yes || echo "no:${waited}s")" yes

exit $fail
