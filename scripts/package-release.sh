#!/usr/bin/env bash
# Đóng gói một phiên bản phát hành và TỰ KIỂM TRA gói trước khi cho tải lên.
# Hướng dẫn: docs/release/huong-dan-trien-khai.md, mục 7.
#
#   scripts/package-release.sh <version>                  # ví dụ 1.0.1: build từ tag v1.0.1, đóng gói, tự kiểm tra
#   scripts/package-release.sh --verify <file.zip> <version>  # chỉ tự kiểm tra một gói có sẵn
#
# Kết quả đạt: dist/hiu-youth-e-office-v<version>.zip và .zip.sha256 (dist/ nằm trong .gitignore).
# Script KHÔNG tải lên GitHub; nó chỉ in lệnh gh để người phát hành tự chạy sau khi xem lại.
# Tự kiểm tra cần gói có GET /api/health (từ v1.0.1). Không dùng Supabase thật: biến môi trường là giá trị
# giữ chỗ trỏ tới 127.0.0.1:9 (cổng không có dịch vụ), nên /api/health trả db: "error" là bình thường;
# điều kiện đạt là app: "ok" và version đúng.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="hiu-youth-e-office"
VERIFY_PORT="${VERIFY_PORT:-3990}"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { printf '[%s] THẤT BẠI: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }
sha256() { if command -v shasum >/dev/null; then shasum -a 256 "$@"; else sha256sum "$@"; fi; }

# Giá trị giữ chỗ dùng khi build và khi tự kiểm tra. Không phải khóa thật.
placeholder_env() {
  env NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 \
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=release-placeholder \
      SUPABASE_SERVICE_ROLE_KEY=release-placeholder \
      AUTH_RATE_LIMIT_PEPPER=release-placeholder-min-32-chars-padding \
      NEXT_PUBLIC_APP_URL=http://localhost:3000 \
      "$@"
}

# ---------- Tự kiểm tra một gói zip ----------
verify_package() {
  local zip="$1" version="$2"
  local dir; dir="$(mktemp -d "${TMPDIR:-/tmp}/verify-${APP_NAME}-XXXX")"
  log "Tự kiểm tra $(basename "$zip") trong $dir"

  ( cd "$dir" && unzip -q "$zip" ) || fail "không giải nén được"
  [[ -f "$dir/package.json" && -d "$dir/.next" ]] || fail "gói thiếu package.json hoặc .next/"
  local pkg_version; pkg_version="$(node -p "require('$dir/package.json').version")"
  [[ "$pkg_version" == "$version" ]] || fail "package.json là $pkg_version, mong đợi $version"
  if [[ -e "$dir/.env.local" ]] || find "$dir" -name ".env*" ! -name ".env.example" | grep -q .; then
    fail "gói chứa file .env (có thể lộ secret)"
  fi

  log "npm ci"
  ( cd "$dir" && npm ci --no-audit --no-fund >"$dir/.verify-npm-ci.log" 2>&1 ) || fail "npm ci lỗi, xem $dir/.verify-npm-ci.log"

  # Module ngoài của Turbopack là symlink .next/node_modules/<tên>-<băm> → ../../node_modules/<tên>.
  # Gói v1.0.1 tải lên lần đầu thiếu các symlink này nên không khởi động được.
  local broken=0 link
  if [[ -d "$dir/.next/node_modules" ]]; then
    local links=()
    for link in "$dir"/.next/node_modules/*; do [[ -L "$link" || -e "$link" ]] && links+=("$link"); done
    if [[ ${#links[@]} -eq 0 ]]; then
      log ".next/node_modules rỗng: thiếu symlink tới module ngoài (winston…)"; broken=1
    fi
    for link in ${links[@]+"${links[@]}"}; do [[ -e "$link" ]] || { log "symlink hỏng: ${link#"$dir"/}"; broken=1; }; done
  fi
  [[ $broken -eq 0 ]] || fail "symlink trong .next/node_modules không trỏ tới module đã cài"

  if lsof -t -iTCP:"$VERIFY_PORT" -sTCP:LISTEN >/dev/null 2>&1; then fail "cổng $VERIFY_PORT đang bận; đặt VERIFY_PORT khác"; fi
  log "Khởi động ở cổng $VERIFY_PORT"
  ( cd "$dir" && placeholder_env PORT="$VERIFY_PORT" LOG_LEVEL=info nohup npm start >"$dir/.verify-start.log" 2>&1 </dev/null & )
  local body="" i
  for i in $(seq 1 120); do
    body="$(curl -s --max-time 2 "http://127.0.0.1:$VERIFY_PORT/api/health" || true)"
    [[ -n "$body" ]] && break
    sleep 0.5
  done
  local pid; pid="$(lsof -t -iTCP:"$VERIFY_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -TERM $pid 2>/dev/null || true

  if [[ -z "$body" ]]; then
    log "Không có phản hồi từ /api/health trong 60 giây. Cuối log khởi động:"
    grep -v "npm notice" "$dir/.verify-start.log" | tail -8 >&2 || true
    fail "gói không khởi động được"
  fi
  log "/api/health: $body"
  node -e '
    const [body, version] = process.argv.slice(1);
    let h; try { h = JSON.parse(body); } catch { process.exit(2); }
    process.exit(h.app === "ok" && h.version === version ? 0 : 1);
  ' "$body" "$version" || fail "/api/health phải có app: \"ok\" và version: \"$version\""
  rm -rf "$dir"
  log "Tự kiểm tra ĐẠT"
}

if [[ "${1:-}" == "--verify" ]]; then
  [[ $# -eq 3 ]] || { echo "Cách dùng: $0 --verify <file.zip> <version>" >&2; exit 64; }
  zip="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
  verify_package "$zip" "$3"
  exit 0
fi

# ---------- Build và đóng gói từ tag ----------
[[ $# -eq 1 && "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Cách dùng: $0 <version>   (ví dụ 1.0.1)" >&2; exit 64; }
VERSION="$1"; TAG="v$VERSION"; NAME="$APP_NAME-$TAG"
cd "$ROOT"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || fail "không có tag $TAG"
[[ "$(git cat-file -t "$TAG")" == "tag" ]] || fail "$TAG không phải tag annotated"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/package-${APP_NAME}-XXXX")"
BUILD="$WORK/build"; STAGE="$WORK/stage"
cleanup() { git -C "$ROOT" worktree remove --force "$BUILD" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "Worktree sạch tại $TAG ($(git rev-parse --short "$TAG^{commit}"))"
git worktree add -q --detach "$BUILD" "$TAG"
cd "$BUILD"
[[ -z "$(git status --porcelain)" ]] || fail "worktree tại $TAG có thay đổi chưa commit"
[[ "$(node -p "require('./package.json').version")" == "$VERSION" ]] || fail "package.json tại $TAG không phải $VERSION"

log "npm ci"
npm ci --no-audit --no-fund >"$WORK/npm-ci.log" 2>&1 || fail "npm ci lỗi, xem $WORK/npm-ci.log"
log "npm run build (NODE_ENV=production, biến giữ chỗ)"
placeholder_env NODE_ENV=production npm run build >"$WORK/build.log" 2>&1 || { tail -20 "$WORK/build.log" >&2; fail "build lỗi"; }
[[ -z "$(git status --porcelain)" ]] || fail "build làm thay đổi file được theo dõi"

log "Ghép gói"
mkdir -p "$STAGE"
git archive "$TAG" | tar -x -C "$STAGE"
# Không đưa báo cáo môn học vào gói; giữ lại tài liệu kỹ thuật của TH2.
rm -rf "$STAGE"/docs/TH1 "$STAGE"/docs/TH3 "$STAGE"/docs/TH4 "$STAGE"/docs/TH2/evidence \
       "$STAGE"/docs/TH2/BaoCao_TH2.* "$STAGE"/docs/TH2/build-docx.sh
rsync -a --exclude cache .next/ "$STAGE/.next/"
cp docs/release/huong-dan-trien-khai.md "$STAGE/HUONG-DAN-TRIEN-KHAI.md"
cat > "$STAGE/BUILD-INFO.txt" <<EOF
HIU Youth E-Office — gói phát hành $TAG
Tag:        $TAG
Commit:     $(git rev-parse "$TAG^{commit}")
Ngày build: $(date '+%Y-%m-%d %H:%M:%S %z')
Node / npm: $(node -v) / $(npm -v 2>/dev/null)
Next.js:    $(node -p "require('next/package.json').version") (npm run build, NODE_ENV=production)
Build bằng scripts/package-release.sh từ worktree sạch tại tag, npm ci, biến môi trường là giá trị giữ chỗ.
Gói đã qua tự kiểm tra: giải nén, npm ci, khởi động, /api/health trả app "ok" và version $VERSION.
Cấu hình (Supabase URL/khóa, APP_URL, LOG_LEVEL, DB_SLOW_MS...) đọc lúc chạy từ .env.local — xem HUONG-DAN-TRIEN-KHAI.md.
Không chứa node_modules, .env.local, secret hay dữ liệu cá nhân.
Không gồm báo cáo môn học (docs/TH1, docs/TH2/evidence, docs/TH3): xem trên GitHub.
EOF

# -y: lưu symlink dưới dạng symlink. Không có -y, zip đi theo symlink; symlink trỏ ra node_modules
# (chưa có trong thư mục ghép) bị bỏ qua và gói không khởi động được (sự cố đóng gói v1.0.1).
( cd "$STAGE" && zip -qr -X -y "$WORK/$NAME.zip" . )
( cd "$WORK" && sha256 "$NAME.zip" > "$NAME.zip.sha256" )
log "Gói: $(du -h "$WORK/$NAME.zip" | cut -f1), SHA-256 $(cut -d' ' -f1 "$WORK/$NAME.zip.sha256")"

verify_package "$WORK/$NAME.zip" "$VERSION"

mkdir -p "$ROOT/dist"
mv "$WORK/$NAME.zip" "$WORK/$NAME.zip.sha256" "$ROOT/dist/"
rm -rf "$WORK/stage"
log "Xong: dist/$NAME.zip"
echo "Tải lên sau khi xem lại (script không tự chạy):"
echo "  gh release create $TAG dist/$NAME.zip dist/$NAME.zip.sha256 --verify-tag --notes-file <ghi-chú>"
