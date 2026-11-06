#!/usr/bin/env bash
# Sao lưu một stack Supabase local bằng một lệnh. Runbook: docs/runbooks/backup-restore.md
#
#   scripts/backup.sh <stack>          # <stack> = project_id trong supabase/config.toml, ví dụ eoffice-v100
#
# Tạo trong $BACKUP_DIR (mặc định ./backups, đã nằm trong .gitignore):
#   <stack>_<YYYYMMDDTHHMMSS>.dump        pg_dump -Fc các schema public, auth, storage (schema + dữ liệu)
#   <stack>_<YYYYMMDDTHHMMSS>.storage/    bản sao thư mục file của Storage (PDF kế hoạch)
#   <stack>_<YYYYMMDDTHHMMSS>.counts.tsv  số bản ghi từng bảng lúc sao lưu, để so sánh sau khi phục hồi
#   <stack>_<YYYYMMDDTHHMMSS>.manifest    stack, thời điểm, phiên bản migration, kích thước, thời gian từng bước
#   <stack>_<YYYYMMDDTHHMMSS>.sha256      checksum của .dump, .counts.tsv và từng file trong .storage/
#
# Kết nối: chạy pg_dump bên trong container DB của stack (docker exec), không cần mật khẩu trong script.
# Ghi đè bằng biến môi trường khi cần: DB_CONTAINER, STORAGE_CONTAINER, BACKUP_DB_USER, BACKUP_DB_NAME, BACKUP_DIR.
set -euo pipefail

if [[ $# -ne 1 || "$1" == -* ]]; then
  echo "Cách dùng: $0 <stack>   (ví dụ: $0 eoffice-v100)" >&2
  exit 64
fi

STACK="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_$STACK}"
STORAGE_CONTAINER="${STORAGE_CONTAINER:-supabase_storage_$STACK}"
DB_USER="${BACKUP_DB_USER:-supabase_admin}"
DB_NAME="${BACKUP_DB_NAME:-postgres}"
SCHEMAS=(public auth storage)

# Mốc thời gian theo mili giây (perl có sẵn trên macOS và Linux; thiếu thì làm tròn theo giây).
now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000' 2>/dev/null || echo "$(date +%s)000"; }
since() { echo $(( $(now_ms) - $1 )); }
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
sha256() { if command -v shasum >/dev/null; then shasum -a 256 "$@"; else sha256sum "$@"; fi; }
psql_db() { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qtA "$@"; }

for container in "$DB_CONTAINER" "$STORAGE_CONTAINER"; do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" != "true" ]]; then
    echo "Container $container không chạy. Kiểm tra: supabase status --workdir <thư mục stack $STACK>" >&2
    exit 69
  fi
done

STORAGE_PATH="$(docker exec "$STORAGE_CONTAINER" printenv FILE_STORAGE_BACKEND_PATH 2>/dev/null || true)"
if [[ -z "$STORAGE_PATH" ]]; then
  echo "Storage của $STACK không dùng backend file (thiếu FILE_STORAGE_BACKEND_PATH); script này không sao lưu được." >&2
  exit 69
fi

TS="$(date +%Y%m%dT%H%M%S)"
NAME="${STACK}_${TS}"
umask 077
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"
if [[ -e "$NAME.dump" ]]; then echo "$NAME.dump đã tồn tại." >&2; exit 73; fi

START=$(now_ms)
log "Sao lưu stack $STACK → $BACKUP_DIR/$NAME.*"

# 1. Số bản ghi: mọi bảng của public, cộng auth.users và storage.objects.
T=$(now_ms)
psql_db > "$NAME.counts.tsv" <<'SQL'
select table_schema || '.' || table_name || E'\t' ||
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_type = 'BASE TABLE'
  and (table_schema = 'public' or (table_schema, table_name) in (('auth', 'users'), ('storage', 'objects')))
order by 1;
SQL
MIGRATION="$(psql_db -c "select coalesce(max(version), '') from supabase_migrations.schema_migrations")"
STEP_COUNT=$(since "$T")
log "Đếm bản ghi: $(wc -l < "$NAME.counts.tsv" | tr -d ' ') bảng, migration $MIGRATION (${STEP_COUNT} ms)"

# 2. Postgres: pg_dump định dạng custom, chạy trong container rồi ghi ra file trên máy.
T=$(now_ms)
SCHEMA_ARGS=()
for schema in "${SCHEMAS[@]}"; do SCHEMA_ARGS+=(-n "$schema"); done
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc "${SCHEMA_ARGS[@]}" > "$NAME.dump"
STEP_DUMP=$(since "$T")
log "pg_dump: $(du -h "$NAME.dump" | cut -f1) (${STEP_DUMP} ms)"

# 3. Storage: chép nguyên thư mục file của Storage (gồm thư mục phiên bản của từng object).
T=$(now_ms)
mkdir "$NAME.storage"
docker exec "$STORAGE_CONTAINER" tar -C "$STORAGE_PATH" -cf - . | tar -C "$NAME.storage" -xf -
FILES=$(find "$NAME.storage" -type f | wc -l | tr -d ' ')
STEP_STORAGE=$(since "$T")
log "Storage: $FILES file, $(du -sh "$NAME.storage" | cut -f1) (${STEP_STORAGE} ms)"

# 4. Checksum.
T=$(now_ms)
{
  sha256 "$NAME.dump" "$NAME.counts.tsv"
  find "$NAME.storage" -type f -print0 | sort -z | xargs -0 -r bash -c 'if command -v shasum >/dev/null; then shasum -a 256 "$@"; else sha256sum "$@"; fi' _
} > "$NAME.sha256"
STEP_SUM=$(since "$T")

cat > "$NAME.manifest" <<EOF
stack=$STACK
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
migration_version=$MIGRATION
schemas=${SCHEMAS[*]}
db_container=$DB_CONTAINER
storage_container=$STORAGE_CONTAINER
storage_path=$STORAGE_PATH
dump_bytes=$(wc -c < "$NAME.dump" | tr -d ' ')
storage_files=$FILES
pg_dump_version=$(docker exec "$DB_CONTAINER" pg_dump --version | awk '{print $NF}')
ms_count=$STEP_COUNT
ms_dump=$STEP_DUMP
ms_storage=$STEP_STORAGE
ms_checksum=$STEP_SUM
ms_total=$(since "$START")
EOF
log "Xong sau $(since "$START") ms. Bản sao lưu: $NAME"
echo "$NAME"
