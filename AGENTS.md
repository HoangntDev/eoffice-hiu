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

## Bộ nhớ dùng chung giữa các công cụ (Codex, Claude Code, Antigravity)

Repo là nguồn sự thật duy nhất. Không dựa vào trí nhớ riêng của từng công cụ hay lịch sử chat.

| File | Vai trò | Cách cập nhật |
|---|---|---|
| `AGENTS.md` | Quy tắc cố định | Chỉ sửa khi đổi quy tắc |
| `docs/context/STATUS.md` | Sổ bàn giao: đang ở giai đoạn nào, việc đang làm, việc tiếp theo, việc chờ quyết định | **Ghi đè**, giữ dưới 150 dòng |
| `docs/context/DECISIONS.md` | Quyết định nghiệp vụ, kỹ thuật đã chốt | **Chỉ thêm mới**; muốn đổi thì thêm mục mới ghi "thay cho D-xxx" |
| GitHub Issues | Danh sách việc cần làm | `gh issue` |
| `docs/context/LOCAL.md` | Ghi chú riêng của máy (stack, cổng, đường dẫn); **không commit** | Tùy ý |

**Khi bắt đầu phiên làm việc:**
1. Đọc `docs/context/STATUS.md` và `docs/context/DECISIONS.md`; đọc `docs/context/LOCAL.md` nếu có.
2. Chạy `git status`, `git log --oneline -10`, `gh issue list --state open`.
3. Không làm lại hoặc đảo ngược quyết định trong `DECISIONS.md`. Gặp điểm chưa chốt thì hỏi người dùng, không tự quyết.

**Khi kết thúc một việc (trong cùng PR):**
1. Cập nhật `docs/context/STATUS.md`: việc vừa xong, việc tiếp theo, việc đang chờ, cảnh báo môi trường.
2. Có quyết định mới đã được người dùng chốt thì thêm mục vào `DECISIONS.md`.
3. Không ghi secret, PIN, dữ liệu cá nhân, IP nội bộ vào các file này (repo công khai).

## Quy trình Git
1. Tạo issue bằng issue form (`gh issue create`). Sự cố vận hành dùng form Bug report, loại "Sự cố vận hành (INC)", label `incident`.
2. Branch từ `main` mới nhất: `<loại>/<số-issue>-<mô-tả-ngắn>`. Ngoại lệ: `hotfix/INC-<nn>-<TenSuCo>`, `cr/CR-<nn>-<TenCR>`.
3. Commit: `<loại>(<phạm-vi>): <mô tả> (#<số-issue>)`. `<loại>` ∈ `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`.
4. Push, mở PR vào `main` bằng `gh pr create` với `Closes #<số>` trong mô tả.
5. Chờ CI xanh (`build-test`, `pgtap`) rồi merge bằng **Create a merge commit** (`gh pr merge --merge`). Không squash, không rebase merge.

- Không commit thẳng vào `main` (ruleset `main-protection` bắt buộc PR). Mỗi PR làm một việc.
- Không rewrite history: không `push --force`, không `commit --amend`/rebase trên nhánh đã push.
- Không merge khi CI đỏ. Sửa lỗi theo RED → GREEN: commit test tái hiện trước (CI đỏ đúng lý do), rồi commit sửa.
- Không xóa, không gắn lại tag (`course-baseline`, `course-final`, `v1.0-local`, `v1.0.0`, `v1.0.1`…; ruleset `tag-protection`). Tag phát hành là tag annotated trên merge commit đã có CI xanh trên `main`.
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
- Dữ liệu demo/test là dữ liệu giả (MSSV `888…`, `999…`, fixture trong `scripts/seed-demo.mjs`).
- Khi chia sẻ log hoặc ảnh, che IP mạng nội bộ (10.x, 172.16–31.x, 192.168.x) bằng `<LAN-IP>` và thay đường dẫn máy bằng `~` hoặc `<repo>`. Có thể dùng IP dành cho tài liệu (`198.51.100.x`, `203.0.113.x`).
- Log ứng dụng không bao giờ ghi PIN, token, cookie, email đầy đủ; MSSV che dạng `221***34` (`src/lib/log.ts`).

## Supabase, migration, môi trường
- Không push lên Supabase cloud, không deploy (Vercel…) nếu chưa được phê duyệt riêng.
- **Không chạy `supabase db reset`** và không áp migration chưa merge vào DB local đang dùng (stack `hiu-youth-e-office`, cổng 543xx).
- Diễn tập, tái hiện sự cố, spike, kiểm tra dựng-từ-đầu: dùng stack tách biệt (copy hoặc worktree, đổi `project_id` và cổng trong `supabase/config.toml`, `supabase start --workdir …`, xong `supabase stop --workdir … [--no-backup]`). Không commit `config.toml` đã đổi cổng.
- Tạo migration bằng `supabase migration new <tên>`. Nếu đặt tên tay, version phải lớn hơn mọi version ở **mọi nhánh**. Kiểm tra:
  `git for-each-ref --format='%(refname:short)' refs/heads refs/remotes | xargs -I{} git ls-tree --name-only {} supabase/migrations/ | sort -u | tail -1`
- Không sửa migration đã merge; muốn đổi thì tạo migration mới.
- Tắt server theo cổng: `kill -TERM $(lsof -t -iTCP:<cổng> -sTCP:LISTEN)`; không `pkill -f "next start"`.

## Quy tắc nghiệp vụ cốt lõi (nguồn: `docs/requirements/`)
- **Email sinh viên:** chỉ `@student.hiu.vn`; phần số khớp MSSV (3 chữ số đầu + 4 chữ số cuối). Đã chốt, không đổi lại sang Gmail.
- **Đăng nhập:** MSSV 10 chữ số + PIN đúng 6 chữ số.
- **Duyệt kế hoạch chương trình:** chỉ Văn phòng Đoàn – Hội (role `office` trên đơn vị `office`). `school_admin` không mặc nhiên có quyền này. Người lập không tự duyệt.
- **Điểm uy tín:** sinh viên không được xem điểm uy tín hay lịch sử trừ/hoàn; chỉ dùng khi chương trình vừa giới hạn chỗ vừa cần duyệt.
- **Điểm rèn luyện:** chỉ tính **điểm dự kiến đề nghị**. Thư ký Khoa cấp điểm ngoài hệ thống, nên không có trạng thái "đã cấp".
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
- Logging: `src/lib/log.ts` (`logEvent`, `requestIdFrom`), file `logs/app-%DATE%.log` (winston, xoay theo ngày, giữ 7 file), mức theo `LOG_LEVEL`, ngưỡng chậm `DB_SLOW_MS`. Kiểm tra log để phát hiện secret hoặc dữ liệu nhạy cảm.
- Sao lưu/phục hồi: `scripts/backup.sh <stack>`, `scripts/restore.sh <stack> <bản sao lưu|latest>` (từ chối stack dev chính nếu thiếu `--confirm-dev-stack`); runbook `docs/runbooks/backup-restore.md` (RPO 1 giờ, RTO 30 phút).
- Đóng gói phát hành: `scripts/package-release.sh <version>` (build từ tag annotated, `zip -y` giữ symlink, tự kiểm tra `/api/health`); kiểm gói có sẵn: `--verify <zip> <version>`. Không ghép gói bằng tay.
- Triển khai, rollback (chỉ khi không đổi schema): `docs/release/huong-dan-trien-khai.md`. Ghi thay đổi vào `CHANGELOG.md` (Keep a Changelog).
- Khi xảy ra sự cố, lập incident report có dòng thời gian và phân tích nguyên nhân bằng 5 Whys.

## Model khuyến nghị

Mặc định dùng `gpt-6.2-sol` + `high`.

| Loại việc | Model | Mức suy luận |
|---|---|---|
| Coding và kiểm thử hằng ngày | `gpt-6.2-sol` | `high` |
| Bắt buộc khi sửa migration, pgTAP, xác thực, phân quyền, thanh toán, đăng ký, điểm danh, `env.ts` hoặc kiến trúc | `gpt-6.2-astra` | `high` |
| Giao diện, ảnh, thao tác trình duyệt | `gpt-6.1-terra` | `high` |
| Chỉnh văn bản, Markdown, cập nhật `docs/context/` | `gpt-6-luna` | `low` |

Các đường dẫn cần Astra gồm `supabase/migrations/`, `supabase/tests/`, `src/lib/auth/`, `src/app/api/auth/`, `src/modules/organization-auth/`, `src/proxy.ts`, `src/modules/payments/`, `src/app/api/payments/`, `src/modules/program-registrations/`, `src/modules/program-attendance/`, `src/app/api/attendance/` và `src/lib/env.ts`.
Nếu model hoặc mức suy luận hiện tại thấp hơn yêu cầu, dừng công việc, báo người dùng lệnh `/model` cần dùng và chờ xác nhận.
