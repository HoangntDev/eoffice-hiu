# UC10 — Đăng bài sau nghiệm thu

Trạng thái: nhánh `feat/program-publication` (13/10/2026), tạo từ `feat/program-acceptance` vì PR #5 (UC9) chưa merge. Nếu mở PR thì đặt base là `feat/program-acceptance`. Chưa merge vào `main`, chưa deploy, không phải release hay CR-01.

## Quy tắc đã chốt và cách hiện thực

| Quy tắc | Hiện thực |
|---|---|
| Văn phòng nghiệm thu xong → chương trình sang "Chờ đăng bài" | Trigger `open_program_publication` trên `program_acceptances` (khi `status` thành `accepted`) tạo dòng `program_publications.status = 'awaiting'` và mốc lịch sử `awaiting`. Hàm UC9 không bị sửa. Chương trình đã nghiệm thu trước UC10 được backfill trong migration. |
| Chỉ Ban Tuyên giáo – Truyền thông xuất bản | Đơn vị `PROPAGANDA_MEDIA` (school_committee). `publication_publisher_grant()`: `committee_manager` hoặc `collaborator` của Ban. Mọi RPC biên tập/xuất bản kiểm quyền này; BTC, Văn phòng, Đoàn Trường, ban khác đều bị `FORBIDDEN`. |
| Khoa gửi nội dung đề xuất | `submit_publication_proposal`: BTC của chương trình (`event_program_manager_grant`). Đề xuất chỉ thêm, không sửa. |
| Ban tự viết hoặc dùng bản nháp sinh từ dữ liệu, rồi biên tập | `save_program_publication(source = manual / generated / proposal)`. Bản nháp sinh trong `src/modules/program-publication/draft.ts` từ `program_publication_facts` (tên, đơn vị, ngày, địa điểm, số hoạt động, số sinh viên tham gia). |
| Bài E-Office do hệ thống xuất bản | `publish_program_eoffice` cần tiêu đề, nội dung, ảnh; lưu `eoffice_path = /news/{id}` và thời gian. Cổng công khai `/news`, `/news/{id}`. |
| Facebook: Ban đăng tay, nhập URL và thời gian thực tế; chưa có Facebook API | `record_program_facebook_post`: URL `https://(www\|m\|web.)facebook.com/…` hoặc `https://fb.watch/…`; thời gian không ở tương lai và không trước lúc nghiệm thu. |
| Lưu tiêu đề, nội dung, ảnh, nền tảng, URL, thời gian và lịch sử chỉnh sửa | `program_publications` giữ giá trị hiện hành. `program_publication_revisions` lưu nguyên giá trị sau mỗi thay đổi, có người, vai trò, lý do, `request_id`; chỉ thêm. Ảnh cũ vẫn nằm trong Storage. |
| Chỉ đánh dấu Đã đăng bài khi đủ dữ liệu | `complete_program_publication` báo `MISSING_PUBLICATION_DATA:` nếu thiếu tiêu đề, nội dung, ảnh, bài E-Office, URL hoặc thời gian Facebook. Ràng buộc CHECK trên bảng chặn thêm một lớp. |
| Bài công khai không có MSSV, danh sách điểm danh, hồ sơ ký, điểm uy tín | Cổng công khai chỉ đọc qua `public_program_posts()` (10 cột an toàn); khách không đọc được bảng bản nháp. Tiêu đề/nội dung có dãy 10 chữ số liền bị chặn ở Zod và DB (`CONTAINS_STUDENT_CODE`). Bản nháp sinh chỉ dùng số liệu tổng hợp. |

## Quyết định thêm trong UC10 (cần người dùng xác nhận nếu khác thực tế)

1. **Đơn vị Ban Tuyên giáo – Truyền thông** chưa có trong DB, nên migration thêm `PROPAGANDA_MEDIA` (cấp Ban thuộc Đoàn Trường). Cả trưởng ban (`committee_manager`) và cộng tác viên (`collaborator`) đều được biên tập và xuất bản. Đoàn Trường cấp vai trò bằng luồng `grant_role` có sẵn.
2. **Hai bước xuất bản**: lên E-Office trước (có URL để chia sẻ), rồi Ban đăng Facebook và nhập URL, cuối cùng bấm "Đánh dấu Đã đăng bài". Lên E-Office chưa đủ để là Đã đăng bài.
3. **Sửa sau khi đã lên E-Office** (nội dung, ảnh) hoặc sửa Facebook sau khi Đã đăng bài phải ghi lý do ≥ 10 ký tự. Không có thao tác gỡ bài.
4. **Khoa gửi đề xuất** đến khi Đã đăng bài; sau đó bị chặn.
5. **Trạng thái "Chờ đăng bài/Đã đăng bài"** nằm ở `program_publications`, không thêm giá trị vào `event_programs.status`, để không ảnh hưởng các kiểm tra `approved` của UC6–UC9.

## API và trang

```
POST /api/event-programs/{id}/publication             {title, body, source, proposalId?, reason?}  Ban lưu bài
POST /api/event-programs/{id}/publication/proposals   {title, body}                                 Khoa đề xuất
POST /api/event-programs/{id}/publication/cover       multipart: file (JPG/PNG/WEBP ≤ 5MB), reason?  Ban đặt ảnh
POST /api/event-programs/{id}/publication/publish                                                   Ban xuất bản E-Office
POST /api/event-programs/{id}/publication/facebook    {url, postedAt (giờ VN), reason?}             Ban ghi bài Facebook
POST /api/event-programs/{id}/publication/complete                                                  Ban đánh dấu Đã đăng bài
GET  /api/news/{id}/cover                                                                           Ảnh bài đã xuất bản (công khai)
```

Trang:
- `/publications`: hàng đợi Chờ đăng bài / Đã đăng bài.
- `/programs/{id}/publication`: biên tập, ảnh, xuất bản, Facebook, đề xuất của Khoa, lịch sử chỉnh sửa. Ban sửa được; BTC gửi đề xuất; Văn phòng chỉ xem.
- `/news`, `/news/{id}`: cổng tin công khai (không cần đăng nhập).
- Trên `/programs/{id}`: mục "Đăng bài" hiện trạng thái cho Ban, BTC và Văn phòng.

## Giới hạn hiện tại

- Chưa tích hợp Facebook API: hệ thống không kiểm tra URL có tồn tại, có đúng Fanpage hay đúng nội dung.
- Kiểm tra MSSV chỉ bắt dãy 10 chữ số. Họ tên sinh viên hoặc ảnh có chứa danh sách không được phát hiện tự động; Ban chịu trách nhiệm duyệt nội dung ảnh.
- Nội dung là văn bản thuần (chia đoạn bằng dòng trống), chưa có trình soạn thảo định dạng hay nhiều ảnh.
- Chưa có gỡ bài, chưa có thông báo cho Khoa khi bài được đăng, chưa có RSS/SEO.
