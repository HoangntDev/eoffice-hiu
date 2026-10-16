@AGENTS.md

# Quy tắc dự án HIU Youth E-Office

## Ngày tháng
- Luôn lấy ngày hiện tại bằng lệnh `date`. Không tự suy đoán ngày, kể cả khi đặt tên migration, viết báo cáo hay ghi lịch sử.

## Quy tắc Git của môn (bắt buộc từ tag `course-baseline`)
1. Tạo issue và gán Milestone đang làm (ví dụ `TH1`).
2. Tạo branch từ `main` mới nhất: `<loại>/<số-issue>-<mô-tả-ngắn>`.
3. Commit theo mẫu `<loại>(<phạm-vi>): <mô tả> (#<số-issue>)`.
4. Push và mở PR vào `main`. Mô tả PR phải ghi `Closes #<số>`.
5. Chờ CI xanh rồi merge bằng **Create a merge commit**. Không squash, không rebase merge.

- `<loại>` ∈ `feat`, `fix`, `docs`, `test`, `chore`, `ci`, `refactor`.
- Không commit thẳng vào `main`. Mỗi PR chỉ làm một việc. Dùng `gh` cho issue và PR.
- Không merge khi CI đỏ. Không xóa và không gắn lại các tag `v1.0-local`, `course-baseline`.
- Không merge, rebase hay sửa các nhánh tính năng chưa vào baseline (`feat/program-acceptance`, `feat/program-publication`) nếu chưa được yêu cầu riêng.

## Migration và cơ sở dữ liệu
- Tạo migration bằng `supabase migration new <tên>`. Nếu đặt tên tay, version phải lớn hơn mọi version đang có ở **mọi nhánh**, kể cả nhánh chưa merge. Hiện cao nhất là `202610170001`. Kiểm tra bằng:
  `git for-each-ref --format='%(refname:short)' refs/heads refs/remotes | xargs -I{} git ls-tree --name-only {} supabase/migrations/ | sort -u | tail -1`
- Không sửa migration đã merge. Muốn thay đổi thì tạo migration mới.
- **Không chạy `supabase db reset`** trên DB local đang dùng. Để kiểm tra dựng-từ-đầu, dùng stack tách biệt: copy hoặc worktree, đổi `project_id` và cổng, `supabase start --workdir …`, xong thì `supabase stop --workdir … --no-backup`.
- Không push lên Supabase cloud, không deploy nếu chưa được phê duyệt riêng.
- Không commit secret, `.env.local`, dữ liệu cá nhân hoặc dữ liệu test thật.

## Kiểm thử (tiết kiệm token)
- Chỉ chạy test liên quan đến thay đổi: `npx vitest run <file>` hoặc `supabase test db` khi đụng SQL.
- Chạy lint và typecheck một lần trước khi mở PR. Không chạy lại suite đã PASS nếu không có thay đổi liên quan.
- Không chạy lại Playwright/E2E cũ nếu không được yêu cầu.
- Không tuyên bố PASS khi chưa chạy. Ghi số liệu thật (số test, số file).

## Quy tắc nghiệp vụ cốt lõi (nguồn: `docs/requirements/`)
- **Email sinh viên:** chỉ nhận `@student.hiu.vn`. Phần số của email phải khớp MSSV: 3 chữ số đầu + 4 chữ số cuối. Quy tắc này đã chốt, không đổi lại sang Gmail.
- **Đăng nhập:** MSSV 10 chữ số + PIN đúng 6 chữ số.
- **Duyệt kế hoạch chương trình:** chỉ Văn phòng Đoàn – Hội (role `office` trên đơn vị `office`). `school_admin` không mặc nhiên có quyền này. Người lập không tự duyệt.
- **Điểm uy tín:** sinh viên không được xem điểm uy tín hay lịch sử trừ/hoàn. Uy tín chỉ dùng khi chương trình vừa giới hạn chỗ vừa cần duyệt.
- **Điểm rèn luyện:** hệ thống chỉ tính **điểm dự kiến đề nghị**. Không có trạng thái "đã cấp", vì Thư ký Khoa cấp điểm ngoài hệ thống.
- **Đăng ký chưa phải điểm danh.** Điểm danh QR theo lượt: token ký HMAC, hết hạn sau 30 giây, kiểm theo giờ server.
- Nghiệp vụ chính nằm trong RPC/RLS PostgreSQL (`supabase/migrations/`). Khi sửa nghiệp vụ, phải sửa hoặc bổ sung pgTAP tương ứng trong `supabase/tests/`.
