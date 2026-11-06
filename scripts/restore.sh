#!/usr/bin/env bash
# Phục hồi một stack Supabase local từ bản sao lưu của scripts/backup.sh. Runbook: docs/runbooks/backup-restore.md
#
#   scripts/restore.sh <stack> <bản sao lưu> [--confirm-dev-stack]
#
#   <stack>        project_id của stack đích, ví dụ eoffice-v100
#   <bản sao lưu>  tên (eoffice-v100_20261106T101500), đường dẫn tới file .dump, hoặc "latest" (mới nhất của <stack>)
#
# Script ghi đè TOÀN BỘ dữ liệu của public, auth, storage và thư mục file Storage của stack đích.
# Stack dev chính (project_id trong supabase/config.toml của repo) bị từ chối nếu không có --confirm-dev-stack.
#
# Các bước: kiểm checksum → kiểm phiên bản migration của đích khớp bản sao lưu → trong MỘT transaction:
# TRUNCATE các bảng rồi nạp lại dữ liệu từ .dump (pg_restore --data-only) → thay thư mục file Storage
# → so sánh số bản ghi với lúc sao lưu.
# Lược đồ (bảng, hàm, RLS) đến từ migration trong git, không phục hồi từ .dump.
#
# Biến môi trường ghi đè: DB_CONTAINER, STORAGE_CONTAINER, BACKUP_DB_USER, BACKUP_DB_NAME, BACKUP_DIR.
set -euo pipefail

usage() {
  echo "Cách dùng: $0 <stack> <bản sao lưu|latest> [--confirm-dev-stack]" >&2
  exit 64
}

CONFIRM_DEV=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --confirm-dev-stack) CONFIRM_DEV=1 ;;
    -*) usage ;;
    *) ARGS+=("$arg") ;;
  esac
done
[[ ${#ARGS[@]} -eq 2 ]] || usage

STACK="${ARGS[0]}"
SOURCE="${ARGS[1]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_$STACK}"
STORAGE_CONTAINER="${STORAGE_CONTAINER:-supabase_storage_$STACK}"
DB_USER="${BACKUP_DB_USER:-supabase_admin}"
DB_NAME="${BACKUP_DB_NAME:-postgres}"

now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000' 2>/dev/null || echo "$(date +%s)000"; }
since() { echo $(( $(now_ms) - $1 )); }
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
psql_db() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qtA "$@"; }

# 0. Chặn stack dev chính.
DEV_STACK="$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$ROOT/supabase/config.toml" 2>/dev/null | head -1)"
if [[ -n "$DEV_STACK" && "$STACK" == "$DEV_STACK" && $CONFIRM_DEV -ne 1 ]]; then
  echo "TỪ CHỐI: '$STACK' là stack dev chính của repo (supabase/config.toml)." >&2
  echo "Phục hồi sẽ ghi đè toàn bộ dữ liệu đang dùng. Nếu thật sự cần, chạy lại kèm --confirm-dev-stack." >&2
  exit 77
fi

# 1. Xác định bản sao lưu.
if [[ "$SOURCE" == "latest" ]]; then
  SOURCE="$(ls -1 "$BACKUP_DIR"/"${STACK}"_*.dump 2>/dev/null | sort | tail -1)"
  [[ -n "$SOURCE" ]] || { echo "Không có bản sao lưu nào của $STACK trong $BACKUP_DIR" >&2; exit 66; }
fi
if [[ "$SOURCE" == */* || "$SOURCE" == *.dump ]]; then
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  NAME="$(basename "$SOURCE" .dump)"
else
  DIR="$BACKUP_DIR"
  NAME="$SOURCE"
fi
for part in dump sha256 manifest counts.tsv; do
  [[ -f "$DIR/$NAME.$part" ]] || { echo "Thiếu $DIR/$NAME.$part" >&2; exit 66; }
done
[[ -d "$DIR/$NAME.storage" ]] || { echo "Thiếu thư mục $DIR/$NAME.storage" >&2; exit 66; }
manifest() { sed -n "s/^$1=//p" "$DIR/$NAME.manifest"; }

for container in "$DB_CONTAINER" "$STORAGE_CONTAINER"; do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" != "true" ]]; then
    echo "Container $container không chạy." >&2
    exit 69
  fi
done
STORAGE_PATH="$(docker exec "$STORAGE_CONTAINER" printenv FILE_STORAGE_BACKEND_PATH)"

START=$(now_ms)
log "Phục hồi $NAME (stack nguồn $(manifest stack), tạo lúc $(manifest created_at)) vào stack $STACK"

# 2. Checksum.
T=$(now_ms)
if command -v shasum >/dev/null; then CHECK=(shasum -a 256 -c --quiet); else CHECK=(sha256sum -c --quiet); fi
( cd "$DIR" && "${CHECK[@]}" "$NAME.sha256" ) || { echo "Checksum KHÔNG khớp, dừng." >&2; exit 65; }
STEP_SUM=$(since "$T")
log "Checksum khớp ($(wc -l < "$DIR/$NAME.sha256" | tr -d ' ') file, ${STEP_SUM} ms)"

# 3. Phiên bản migration phải khớp, vì chỉ nạp lại dữ liệu chứ không đổi lược đồ.
TARGET_MIGRATION="$(psql_db -c "select coalesce(max(version), '') from supabase_migrations.schema_migrations")"
if [[ "$TARGET_MIGRATION" != "$(manifest migration_version)" ]]; then
  echo "Migration của đích ($TARGET_MIGRATION) khác bản sao lưu ($(manifest migration_version)). Đưa đích về đúng phiên bản trước." >&2
  exit 65
fi

# 4. Postgres: TRUNCATE rồi nạp dữ liệu trong một transaction; lỗi ở bất kỳ đâu thì không đổi gì.
T=$(now_ms)
TMP="/tmp/restore_$NAME"
docker exec "$DB_CONTAINER" mkdir -p "$TMP"
docker cp -q "$DIR/$NAME.dump" "$DB_CONTAINER:$TMP/backup.dump"
TABLES="$(psql_db -c "select string_agg(format('%I.%I', table_schema, table_name), ', ' order by 1)
  from information_schema.tables
  where table_type = 'BASE TABLE' and table_schema in ('public', 'auth', 'storage')
    and (table_schema, table_name) not in (('auth', 'schema_migrations'), ('storage', 'migrations'))")"
docker exec "$DB_CONTAINER" sh -c "pg_restore -l '$TMP/backup.dump' \
  | grep -v -E ' TABLE DATA (auth schema_migrations|storage migrations) ' > '$TMP/toc.list'"
docker exec "$DB_CONTAINER" sh -c "{
    echo 'BEGIN;'
    echo 'SET session_replication_role = replica;'
    echo 'TRUNCATE $TABLES;'
    pg_restore --data-only -L '$TMP/toc.list' -f - '$TMP/backup.dump'
    echo 'COMMIT;'
  } | psql -U '$DB_USER' -d '$DB_NAME' -v ON_ERROR_STOP=1 -q -o /dev/null"
docker exec "$DB_CONTAINER" rm -rf "$TMP"
STEP_DB=$(since "$T")
log "Postgres đã nạp lại (${STEP_DB} ms)"

# 5. Storage: thay toàn bộ thư mục file bằng bản sao lưu.
T=$(now_ms)
docker exec "$STORAGE_CONTAINER" sh -c "find '$STORAGE_PATH' -mindepth 1 -delete"
tar -C "$DIR/$NAME.storage" -cf - . | docker exec -i "$STORAGE_CONTAINER" tar -C "$STORAGE_PATH" -xf -
STEP_STORAGE=$(since "$T")
log "Storage: $(find "$DIR/$NAME.storage" -type f | wc -l | tr -d ' ') file (${STEP_STORAGE} ms)"

# 6. So sánh số bản ghi với lúc sao lưu.
T=$(now_ms)
AFTER="$(mktemp)"
psql_db > "$AFTER" <<'SQL'
select table_schema || '.' || table_name || E'\t' ||
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_type = 'BASE TABLE'
  and (table_schema = 'public' or (table_schema, table_name) in (('auth', 'users'), ('storage', 'objects')))
order by 1;
SQL
if diff -u "$DIR/$NAME.counts.tsv" "$AFTER" >/dev/null; then
  log "Số bản ghi khớp lúc sao lưu: $(wc -l < "$AFTER" | tr -d ' ') bảng ($(since "$T") ms)"
  RESULT=0
else
  log "Số bản ghi KHÁC lúc sao lưu:"
  diff -u "$DIR/$NAME.counts.tsv" "$AFTER" | sed -n '3,$p' | grep '^[-+]' || true
  RESULT=1
fi
rm -f "$AFTER"
log "Tổng thời gian phục hồi: $(since "$START") ms (checksum ${STEP_SUM}, postgres ${STEP_DB}, storage ${STEP_STORAGE})"
log "Tiếp theo: khởi động lại web nếu đã dừng, chạy smoke test (docs/testing/smoke-test.md)."
exit $RESULT
