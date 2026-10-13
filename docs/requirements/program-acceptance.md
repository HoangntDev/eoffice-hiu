# UC9 — Nghiệm thu chương trình, uy tín và khiếu nại điểm danh

Trạng thái: nhánh `feat/program-acceptance` (13/10/2026). Đã kiểm bằng pgTAP và một luồng UI trên trình duyệt local. Chưa merge, chưa deploy. Không phải release hay CR-01.

## Quy tắc đã chốt và cách hiện thực

| Quy tắc | Nguồn | Hiện thực |
|---|---|---|
| BTC khóa điểm danh, xem từng sinh viên: lượt, Có tham gia/Hoàn thành/Đăng ký nhưng không tham gia, điểm dự kiến theo quy tắc UC8; xuất bảng | Yêu cầu UC9, 11.2 | `lock_program_attendance`; `program_acceptance_attendance`; CSV `/acceptance/export` |
| Không ghi là điểm Thư ký Khoa đã cấp | 12.2 | Cột CSV "Điểm rèn luyện dự kiến đề nghị (chưa được Thư ký Khoa cấp)"; không có trạng thái "đã cấp" |
| Repo chưa có mẫu đơn chính thức → chỉ bản xem trước + bảng dữ liệu | Yêu cầu UC9 | `/programs/{id}/acceptance/preview` ghi "BẢN XEM TRƯỚC DỮ LIỆU — không phải mẫu Đơn đề nghị chính thức" |
| Hồ sơ: Đơn đề nghị có chữ ký Trưởng BTC (PDF scan), báo cáo kết quả, ảnh minh chứng; giữ phiên bản, người nộp, thời gian, lịch sử sửa/nộp lại | Yêu cầu UC9 | `program_acceptance_documents` (thay thế = `superseded_*`, rút = `withdrawn_*` + lý do; không xóa); `program_acceptance_history`; `submission_count` |
| Chỉ Văn phòng nghiệm thu; người nộp không tự duyệt | 16.1, UC6 | `review_program_acceptance` dùng `event_program_reviewer_grant`; chặn `SELF_REVIEW_FORBIDDEN` nếu đã nộp hồ sơ này hoặc đang giữ vai trò BTC của chương trình |
| Nghiệm thu chốt snapshot | Yêu cầu UC9 | `program_acceptance_snapshots` + `program_acceptance_results` (chỉ thêm, trigger chặn sửa/xóa); khiếu nại được chấp nhận tạo phiên bản mới |
| Trừ đúng 5 điểm sau nghiệm thu, một lần mỗi chương trình | 15.1, 16.1 | `apply_absence_penalties` + unique index `(program_id, user_id) where kind='absence_penalty'`; nghiệm thu lặp → `INVALID_TRANSITION` |
| Có ≥1 lượt (kể cả 0 điểm) không trừ; hủy / chờ duyệt / bị từ chối / chưa nghiệm thu không trừ | 15.1 | Chỉ đăng ký `accepted` không có bản ghi điểm danh nào, chỉ trong `review_program_acceptance` khi chương trình `approved` |
| Khiếu nại đến hết học kỳ; BTC kiểm tra, bổ sung đúng lượt; hoàn +5; tính lại; giữ cả -5 và +5 | 16.2 C, 16.5 C | `file_attendance_complaint` (hạn = `ends_on` của học kỳ, giờ VN); `resolve_attendance_complaint` ghi bản ghi `source='complaint'`, hoàn `+5` một lần (unique index), snapshot mới |
| Cấu hình học kỳ theo khoảng ngày, vai trò cấp Trường | Review PR #3, yêu cầu UC9 | `/office/terms`, `save_academic_term`; quyền: `school_admin` (Đoàn Trường) hoặc `office` (Văn phòng) |
| Ngày chương trình ngoài mọi học kỳ → báo thiếu, không chốt âm thầm | Yêu cầu UC9 | `TERM_NOT_CONFIGURED` chặn nghiệm thu; cảnh báo trên trang nghiệm thu và danh sách "chưa thuộc học kỳ nào" ở `/office/terms` |
| Sinh viên xem kết quả và thống kê, không xem uy tín/xếp hạng/sổ trừ hoàn | 14.2 (sửa đổi), 25.28 | `my_program_results()` không có cột uy tín hay điểm dự kiến; sinh viên không đọc `reputation_adjustments` hay `program_acceptance_results` |
| BTC chỉ xem uy tín khi vừa giới hạn chỗ vừa cần duyệt; Văn phòng xem dữ liệu nghiệm thu, khiếu nại | 15.2, 16.3 | BTC không gọi được `program_reputation_ledger` (chỉ Văn phòng); uy tín BTC chỉ còn ở danh sách đăng ký UC7 như cũ |

## Quyết định thêm trong UC9 (cần người dùng xác nhận nếu khác thực tế)

1. **Hủy chương trình.** Trước UC9 chưa có trạng thái hủy, nên UC9 thêm `event_programs.status = 'cancelled'` và `cancel_event_program`.
   - Người hủy: BCH Đoàn Khoa (faculty_manager) sở hữu chương trình hoặc Văn phòng. Phải có lý do.
   - Chỉ hủy được chương trình đã chấp thuận và chưa nghiệm thu. Khi hủy, các lượt và đăng ký đang mở sẽ đóng.
   - Chương trình hủy không vào nghiệm thu, nên không ai bị trừ điểm.
2. **Khóa điểm danh.** Khóa khi mọi lượt đã đóng và đăng ký đã đóng. Sau khi khóa:
   - Trigger chặn đổi kế hoạch/lượt, chặn điểm danh QR và chặn nhận thêm đăng ký `accepted` (`ATTENDANCE_LOCKED`). Lý do chặn đăng ký: người được nhận sau khi khóa sẽ bị tính vắng oan.
   - BTC được mở khóa, có lý do, khi hồ sơ chưa nộp hoặc đang bị yêu cầu bổ sung.
   - Quy tắc QR và đăng ký đã merge không đổi. Hàm UC7/UC8 không bị sửa; khóa được thêm bằng trigger.
3. **Học kỳ của chương trình** là học kỳ chứa ngày bắt đầu chương trình (giờ Việt Nam). Học kỳ đã có nghiệm thu hoặc giao dịch uy tín thì không đổi được năm học, mã hay ngày (`TERM_IN_USE`).
4. **Hồ sơ đủ** gồm: 1 Đơn đề nghị hiện hành (PDF), 1 báo cáo hiện hành (PDF) và ≥1 minh chứng (ảnh JPG/PNG/WEBP hoặc PDF). Mỗi tệp tối đa 5MB, kiểm cả đuôi, MIME và chữ ký tệp. Lưu ở bucket riêng tư `program-acceptance-files`.
5. **Khiếu nại** chỉ cho lượt đã từng mở, mà sinh viên chưa có bản ghi.
   - Mỗi lượt có tối đa một khiếu nại đang chờ hoặc đã nhận. Khiếu nại bị từ chối thì được gửi lại.
   - BTC xử lý phải ghi lý do. Văn phòng chỉ xem.
   - Hoàn +5 chỉ khi người đó đã bị trừ ở chương trình này, và tối đa một lần dù có nhiều khiếu nại được chấp nhận.

## API và trang

```
POST /api/event-programs/{id}/acceptance/lock                      {action: lock|unlock, reason}
POST /api/event-programs/{id}/acceptance/documents                 multipart: kind, file
GET  /api/event-programs/{id}/acceptance/documents/{docId}         signed URL 60 giây
POST /api/event-programs/{id}/acceptance/documents/{docId}/withdraw {reason}
POST /api/event-programs/{id}/acceptance/submit
POST /api/event-programs/{id}/acceptance/review                    {decision: accept|request_changes|reject, reason}
GET  /api/event-programs/{id}/acceptance/export                    CSV dữ liệu đề nghị
POST /api/event-programs/{id}/complaints                           {sessionId, message}
POST /api/complaints/{complaintId}/resolve                         {decision: accept|reject, reason}
POST /api/event-programs/{id}/cancel                               {reason}
POST /api/academic-terms                                           {id?, academicYear, termCode, name, startsOn, endsOn}
```

Trang:
- `/programs/{id}/acceptance`: dùng chung cho BTC và Văn phòng. Gồm khóa điểm danh, bảng kết quả, hồ sơ và phiên bản tệp, xét nghiệm thu, các phiên bản snapshot, khiếu nại, sổ uy tín (chỉ Văn phòng) và lịch sử.
- `/programs/{id}/acceptance/preview`: bản xem trước dữ liệu đơn.
- `/participation`: kết quả của sinh viên.
- `/office/terms`: cấu hình học kỳ.
- Hàng đợi "Hồ sơ nghiệm thu chờ xét" ở `/programs` (Văn phòng).
- Trên `/programs/{id}`: mục "Kết quả tham gia" và form khiếu nại cho sinh viên; nút hủy chương trình.

## Giới hạn hiện tại

- Chưa có mẫu Đơn đề nghị chính thức trong repo, nên chỉ có bản xem trước và CSV. Hệ thống không xác minh chữ ký trên PDF scan; Văn phòng đối chiếu bằng mắt.
- Tệp đã rút hoặc bị thay vẫn nằm trong Storage để giữ lịch sử. Chưa có chính sách dọn tệp.
- Văn phòng không xử lý khiếu nại thay BTC. Chưa có thông báo (email/in-app) khi có khiếu nại hay kết quả.
- Xếp loại uy tín (Xuất sắc…Kém, 15.1) chưa hiển thị ở đâu, vì sinh viên không được xem; chưa có màn hình tổng hợp uy tín toàn trường cho Văn phòng.
- Sau khi nghiệm thu, không có luồng "mở lại nghiệm thu"; mọi điều chỉnh đi qua khiếu nại.
