# Báo cáo UC9 — Nghiệm thu, uy tín và khiếu nại điểm danh (13/10/2026)

Nhánh `feat/program-acceptance` tạo từ `main` mới nhất (`5a34ede`, đã có UC8 merge qua PR #4). Đã push. **Chưa mở PR** vì máy không có `gh`, nên CI chưa chạy. Chưa merge. Không gọi là release hay CR-01. Không đụng Supabase cloud. Không `db reset`.

## Đã làm
- **Migration `202610160001_program_acceptance.sql`** (áp lên DB local bằng `supabase migration up --local`):
  - Bảng mới: hồ sơ nghiệm thu, tệp hồ sơ có phiên bản, snapshot và kết quả từng sinh viên (chỉ thêm), khiếu nại, lịch sử.
  - Sổ uy tín có thêm loại giao dịch `absence_penalty` / `absence_refund`. Unique index bảo đảm trừ một lần và hoàn một lần mỗi chương trình. Trigger chặn sửa/xóa sổ, snapshot và lịch sử.
  - Thêm trạng thái hủy chương trình `cancelled`.
  - Khóa điểm danh bằng trigger. Không sửa hàm QR hay đăng ký đã merge.
- **Luồng:**
  1. BTC khóa điểm danh, xem bảng và xuất CSV (cột "điểm dự kiến đề nghị, chưa được Thư ký Khoa cấp"), xem bản xem trước dữ liệu đơn. Bản này ghi rõ không phải mẫu chính thức, vì repo chưa có mẫu.
  2. BTC tải Đơn đề nghị PDF scan, báo cáo PDF và ảnh minh chứng, rồi nộp. Mỗi lần tải là một phiên bản; rút tệp phải có lý do.
  3. Văn phòng yêu cầu bổ sung, từ chối hoặc nghiệm thu. Người nộp và BTC không tự nghiệm thu. Thiếu học kỳ thì chặn với `TERM_NOT_CONFIGURED`.
  4. Nghiệm thu chốt snapshot v1 và trừ đúng 5 điểm cho người được nhận mà 0 lượt.
  5. Sinh viên khiếu nại đến hết học kỳ. BTC chấp nhận thì hệ thống bổ sung đúng lượt, hoàn +5 một lần và tạo snapshot mới.
  6. Đoàn Trường hoặc Văn phòng cấu hình học kỳ tại `/office/terms`.
  7. Sinh viên xem kết quả và thống kê tại `/participation`, không có uy tín.
- **Tài liệu:** `docs/requirements/program-acceptance.md` (có mục quyết định cần xác nhận), UC9 trong `mvp-scope.md`, mục UC9 trong `docs/testing/test-report.md`.

## Kết quả chạy thật
| Kiểm thử | Kết quả |
|---|---|
| pgTAP `009`: quyền nghiệm thu, hồ sơ thiếu, nghiệm thu lặp, 0 lượt → -5, ≥1 lượt 0 điểm → không trừ, chờ duyệt/từ chối/hủy/chưa nghiệm thu → không trừ, khiếu nại, hoàn đúng một lần, hạn hết học kỳ, thiếu học kỳ, sổ chỉ thêm, quyền riêng tư | 64/64 PASS |
| pgTAP `005`/`007`/`008`: regression, vì migration đổi ràng buộc và thêm trigger vào bảng UC6–UC8. Không phải E2E | 157/157 PASS |
| Vitest `program-acceptance` (chỉ tệp mới) | 6/6 PASS |
| Luồng UI Chrome: BTC nộp → Văn phòng nghiệm thu → SV xem kết quả, khiếu nại → BTC chấp nhận → SV xem lại | 20/22 PASS lần chính. B4 (UI báo hồ sơ thiếu) chạy lại riêng: PASS. B10 (UI báo thiếu học kỳ) chỉ xác nhận qua log server `TERM_NOT_CONFIGURED`, chưa chụp được dòng chữ trên UI. Hai lỗi do script đọc nhầm route announcer của Next |
| Lint, typecheck toàn repo (1 lần) | PASS |

Không chạy lại E2E UC6–UC8. Toàn bộ Vitest và build để CI của PR chạy.

## Giới hạn còn lại
- **CI chưa chạy**, vì PR chưa mở.
- **Quyết định tự đặt cần xác nhận:**
  - Thêm trạng thái hủy chương trình. Người hủy là BCH Khoa hoặc Văn phòng, trước khi nghiệm thu.
  - Học kỳ của chương trình lấy theo ngày bắt đầu.
  - Quyền cấu hình học kỳ là `school_admin` + `office`.
  - Sau khi khóa, không nhận thêm đăng ký.
  - BTC được mở khóa khi chưa nộp.
- Chưa có mẫu Đơn đề nghị chính thức. Không xác minh chữ ký trên PDF.
- Chưa có thông báo khi có khiếu nại hay kết quả. Chưa có màn hình tổng hợp uy tín toàn trường. Không có luồng mở lại nghiệm thu.
- **Dữ liệu thử chỉ ở DB local** (không commit):
  - Học kỳ HK1 2026-2027.
  - Chương trình `815085fe` đã nghiệm thu, kèm -5/+5 cho `2026990005`. Sổ chỉ thêm nên không xóa được qua ứng dụng.
  - Chương trình `78312b4a` đã đóng lượt và đóng đăng ký (khóa rồi mở khóa).

## Việc của người dùng
Mở PR tại https://github.com/HoangntDev/eoffice-hiu/pull/new/feat/program-acceptance, chờ CI xanh rồi mới merge.
