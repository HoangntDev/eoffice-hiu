<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Quy tắc dự án HIU Youth E-Office

Áp dụng cho mọi công cụ hỗ trợ (Codex, Claude Code…). `CLAUDE.md` nạp file này. Khối `nextjs-agent-rules` ở trên do `next dev` quản lý: không sửa, không xóa.

## Nguyên tắc chung
- Lấy ngày hiện tại bằng lệnh `date`; không tự suy đoán ngày (tên migration, báo cáo, lịch sử).
- Không bịa số liệu. Mọi con số (test, thời gian, kích thước) lấy từ output lệnh thật; không tuyên bố PASS khi chưa chạy. Số liệu đo bằng mô phỏng phải ghi rõ là mô phỏng.
- Ảnh bằng chứng là màn hình thật: Terminal bằng `screencapture -l <window id>`; trang GitHub bằng trình duyệt + `screencapture -R` (bỏ thanh tab); trang cần đăng nhập bằng Playwright. Mở xem lại từng ảnh trước khi commit.
- Log và kết quả lệnh của bài thực hành lưu trong `docs/TH<n>/evidence/`.

## Git workflow của môn (bắt buộc từ tag `course-baseline`)
1. Tạo issue bằng issue form (`gh issue create`), gán Milestone đang làm (`TH4`…). Sự cố vận hành: form Bug report, loại "Sự cố vận hành (INC)", label `incident`.
2. Branch từ `main` mới nhất: `<loại>/<số-issue>-<mô-tả-ngắn>`. Ngoại lệ: `hotfix/INC-<nn>-<TenSuCo>`, `cr/CR-<nn>-<TenCR>`.
3. Commit: `<loại>(<phạm-vi>): <mô tả> (#<số-issue>)`. `<loại>` ∈ `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`.
4. Push, mở PR vào `main` bằng `gh pr create`; mô tả có `Closes #<số>`, gán cùng Milestone.
5. Chờ CI xanh (`build-test`, `pgtap`) rồi merge bằng **Create a merge commit** (`gh pr merge --merge`). Không squash, không rebase merge.

- Không commit thẳng vào `main` (ruleset `main-protection` bắt buộc PR). Mỗi PR làm một việc.
- Không rewrite history: không `push --force`, không `commit --amend`/rebase trên nhánh đã push.
- Không merge khi CI đỏ. Sửa lỗi theo RED → GREEN: commit test tái hiện trước (CI đỏ đúng lý do), rồi commit sửa.
- Không xóa, không gắn lại tag (`course-baseline`, `v1.0-local`, `v1.0.0`, `v1.0.1`…; ruleset `tag-protection`). Tag phát hành là tag annotated trên merge commit đã có CI xanh trên `main`.
- Không merge, rebase hay sửa các nhánh chưa vào baseline (`feat/program-acceptance`, `feat/program-publication`, PR #5, #6) nếu không được yêu cầu riêng. `spike/*` không merge.
- Kiểm tra lịch sử `main` (lệnh thứ hai phải rỗng):
  ```
  git log --first-parent --oneline course-baseline..main
  git log --first-parent --no-merges --oneline course-baseline..main
  ```

## Không ghi dấu hiệu công cụ AI
- Commit message và mô tả PR/issue **không** có dòng `Co-Authored-By`, "Generated with …", `Claude-Session` hay bất kỳ dấu hiệu công cụ AI nào.

## Secret, dữ liệu cá nhân, mạng nội bộ
- Không commit secret, `.env*` (trừ `.env.example` chỉ có giá trị giữ chỗ), `logs/`, `backups/`, `dist/`, dữ liệu cá nhân thật hoặc dữ liệu test thật. Không dán secret, token, PIN, cookie vào log, issue, PR, báo cáo.
- Dữ liệu demo/test là dữ liệu giả (MSSV `888…`, `999…`, tài khoản demo trong `docs/TH2/demo-data.md`).
- Log và ảnh bằng chứng: che IP mạng nội bộ (10.x, 172.16–31.x, 192.168.x) bằng `<LAN-IP>`; đường dẫn máy thay bằng `~` hoặc `<repo>`. IP dành cho tài liệu (`198.51.100.x`, `203.0.113.x`) dùng được.
- Log ứng dụng không bao giờ ghi PIN, token, cookie, email đầy đủ; MSSV che dạng `221***34` (`src/lib/log.ts`).

## Supabase, migration, môi trường
- Không push lên Supabase cloud, không deploy (Vercel…) nếu chưa được phê duyệt riêng.
- **Không chạy `supabase db reset`** và không áp migration chưa merge vào DB local đang dùng (stack `hiu-youth-e-office`, cổng 543xx).
- Diễn tập, tái hiện sự cố, spike, kiểm tra dựng-từ-đầu: dùng stack tách biệt (copy hoặc worktree, đổi `project_id` và cổng trong `supabase/config.toml`, `supabase start --workdir …`, xong `supabase stop --workdir … [--no-backup]`). Không commit `config.toml` đã đổi cổng.
- Tạo migration bằng `supabase migration new <tên>`. Nếu đặt tên tay, version phải lớn hơn mọi version ở **mọi nhánh** (hiện cao nhất `202610300003`, nhánh spike CR-01). Kiểm tra:
  `git for-each-ref --format='%(refname:short)' refs/heads refs/remotes | xargs -I{} git ls-tree --name-only {} supabase/migrations/ | sort -u | tail -1`
- Không sửa migration đã merge; muốn đổi thì tạo migration mới.
- Tắt server theo cổng: `kill -TERM $(lsof -t -iTCP:<cổng> -sTCP:LISTEN)`; không `pkill -f "next start"`.

## Quy tắc nghiệp vụ cốt lõi (nguồn: `docs/requirements/`)
- **Email sinh viên:** chỉ `@student.hiu.vn`; phần số khớp MSSV (3 chữ số đầu + 4 chữ số cuối). Đã chốt, không đổi lại sang Gmail.
- **Đăng nhập:** MSSV 10 chữ số + PIN đúng 6 chữ số.
- **Duyệt kế hoạch chương trình:** chỉ Văn phòng Đoàn – Hội (role `office` trên đơn vị `office`). `school_admin` không mặc nhiên có quyền này. Người lập không tự duyệt.
- **Điểm uy tín:** sinh viên không được xem điểm uy tín hay lịch sử trừ/hoàn; chỉ dùng khi chương trình vừa giới hạn chỗ vừa cần duyệt.
- **Điểm rèn luyện:** chỉ tính **điểm dự kiến đề nghị**; không có trạng thái "đã cấp".
- **Đăng ký chưa phải điểm danh.** Điểm danh QR theo lượt: token ký HMAC, hết hạn 30 giây, kiểm theo giờ server.
- Nghiệp vụ chính nằm trong RPC/RLS PostgreSQL (`supabase/migrations/`). Sửa nghiệp vụ thì sửa hoặc thêm pgTAP trong `supabase/tests/`.
- Hàm kiểm quyền/kiểm phiên gọi nhiều lần viết bằng plpgsql, không dùng hàm SQL `security definer` có `SET search_path` (chậm khoảng 35 lần do lập kế hoạch lại mỗi lần gọi).
- Biến `NEXT_PUBLIC_*` đọc lúc chạy qua `src/lib/env.ts` bằng tên động; không viết `process.env.NEXT_PUBLIC_…` trực tiếp (bản build có thể thay bằng giá trị lúc build).

## Kiểm thử (chạy phần liên quan, ghi số thật)
- Vitest: `npx vitest run <file>`; toàn bộ `npm test`; CI dùng `npm run test:ci`.
- pgTAP: `supabase test db` (cần stack đang chạy; khi đụng SQL chạy trên stack tách biệt nếu migration chưa merge).
- Trước khi mở PR: `npm run lint`, `npm run typecheck` một lần; `npm run build` khi đổi cấu hình/route.
- Không chạy lại suite đã PASS nếu không có thay đổi liên quan; không chạy lại Playwright/E2E cũ nếu không được yêu cầu.
- Smoke test 8 bước: `docs/testing/smoke-test.md` (bước 2–4 bằng `curl`, bước 5–8 trên giao diện); chạy trên stack không phải DB đang dùng; ghi kết quả vào bảng cuối file.
- `GET /api/health` → `{app, db, config, version}`; 200 khi bình thường.

## Vận hành, phát hành
- Logging: `src/lib/log.ts` (`logEvent`, `requestIdFrom`), file `logs/app-%DATE%.log` (winston, xoay theo ngày, giữ 7 file), mức theo `LOG_LEVEL`, ngưỡng chậm `DB_SLOW_MS`. Kiểm tra YC5: `grep -niE "password|token|secret|apikey|pin" logs/*.log`.
- Sao lưu/phục hồi: `scripts/backup.sh <stack>`, `scripts/restore.sh <stack> <bản sao lưu|latest>` (từ chối stack dev chính nếu thiếu `--confirm-dev-stack`); runbook `docs/runbooks/backup-restore.md` (RPO 1 giờ, RTO 30 phút).
- Đóng gói phát hành: `scripts/package-release.sh <version>` (build từ tag annotated, `zip -y` giữ symlink, tự kiểm tra `/api/health`); kiểm gói có sẵn: `--verify <zip> <version>`. Không ghép gói bằng tay.
- Triển khai, rollback (chỉ khi không đổi schema): `docs/release/huong-dan-trien-khai.md`. Ghi thay đổi vào `CHANGELOG.md` (Keep a Changelog).
- Sự cố: incident report theo mẫu ở `docs/TH3/INC-01-ThieuCauHinh/incident-report.md` (8 mục, dòng thời gian, 5 Whys).
