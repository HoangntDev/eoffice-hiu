# Test case các use case chính (TH2 – nhiệm vụ 4)

Issue #27. Phạm vi gồm bốn use case chính của đồ án:

| UC | Tên | Luồng |
|---|---|---|
| UC-A | Hồ sơ Đoàn viên | kê khai → nộp Sổ Đoàn → CTV đề xuất → Văn phòng công nhận |
| UC-B | Kế hoạch chương trình | Đoàn Khoa nộp → Văn phòng duyệt / trả sửa / từ chối |
| UC-C | Đăng ký tham gia | cấu hình, đối tượng, chỉ tiêu, BTC duyệt |
| UC-D | Điểm danh QR theo lượt | mở lượt, phát QR 30 giây, điểm danh, điểm dự kiến đề nghị |

Tài khoản, danh mục, cơ cấu tổ chức và biểu mẫu động là phần nền. Chúng được kiểm gián tiếp qua bước đăng nhập và dữ liệu seed.

## Môi trường thực thi

- **Bản build:** `main` tại `15f0a5f`, build production (`npm run build` rồi `next start -p 3200`) trong một worktree riêng.
- **Dữ liệu:** stack Supabase demo tách biệt (`hiu-eoffice-demo`, cổng 553xx), dựng và seed theo `docs/TH2/demo-data.md`. Không dùng DB local đang dùng.
- **Tài khoản:** dữ liệu giả, PIN chung `123456`.
- **Cách chạy:** `docs/TH2/evidence/test-run/run-test-cases.mjs` gọi API thật của bản build như trình duyệt (cookie phiên, header `origin`), rồi đọc trạng thái DB demo bằng `psql` trong container DB demo.
  ```bash
  BASE_URL=http://localhost:3200 node docs/TH2/evidence/test-run/run-test-cases.mjs
  ```
  Mỗi lần chạy cần một DB demo vừa seed, vì test làm thay đổi dữ liệu.
- **Log:**

  | Lần | Ngày | Kết quả | Ghi chú |
  |---|---|---|---|
  | 1 | 20/10/2026 | 13/15 PASS | Có một lỗi dữ liệu test (xem bên dưới) |
  | 2 | 20/10/2026 | 14/15 PASS | Chạy lại trên DB demo vừa seed. Fail duy nhất: K1 |

  Log tương ứng: `evidence/test-run/run-1-truoc-sua-K1.log`, `evidence/test-run/run-2-truoc-sua-K1.log`.

**Lỗi dữ liệu test ở lần 1.** TC-UCB-02 gửi `decision: "needs_changes"` và mong đợi HTTP 400. Thực tế, API nhận giá trị `request_changes` và trả lỗi validation bằng 422. Đây là lỗi khi soạn test case, không phải lỗi hệ thống. Đã sửa dữ liệu và kết quả mong đợi, reset DB demo, rồi chạy lại ở lần 2.

## Bảng test case

| Mã | UC | Tiền điều kiện | Các bước | Dữ liệu | Kết quả mong đợi | Kết quả thực tế (lần 2) | Trạng thái |
|---|---|---|---|---|---|---|---|
| TC-UCA-01 | UC-A | Hồ sơ của Hân ở trạng thái `collaborator_recommended` (CTV đã đề xuất). Mai có vai trò `office` | 1. Mai đăng nhập. 2. Ghi nhận Văn phòng đã tiếp nhận Sổ Đoàn của Hân. 3. Chọn "Công nhận", ghi lý do | Hân 2211110103; Mai 2201110202; ngày nhận Sổ = hôm nay | Ghi Sổ 200. Công nhận 200, `status=recognized`. DB: hồ sơ và `union_memberships` đều `recognized` | Sổ: 200 "Đã ghi nhận tiếp nhận Sổ Đoàn.". Công nhận: 200 `recognized`. DB: `recognized/recognized` | Pass |
| TC-UCA-02 | UC-A | Hồ sơ của Ngọc ở trạng thái `submitted`, Văn phòng **chưa** nhận Sổ | Mai chọn "Công nhận" hồ sơ của Ngọc | Ngọc 2211110102 | 422, không công nhận được khi chưa tiếp nhận Sổ Đoàn. DB giữ `submitted` | 422 `REVIEW_FAILED` "Chưa thể công nhận trước khi Văn phòng tiếp nhận Sổ Đoàn.". DB `submitted` | Pass |
| TC-UCA-03 | UC-A | An là sinh viên, không có vai trò xử lý hồ sơ | An gọi API xét duyệt hồ sơ của Ngọc, dùng mã vai trò của Văn phòng | An 2211110101 | 403, DB giữ `submitted` | 403 `FORBIDDEN` "Bạn không có vai trò xử lý hồ sơ.". DB `submitted` | Pass |
| TC-UCB-01 | UC-B | Kế hoạch "Giải bóng đá" do Quân (Đoàn Khoa CNKT) lập, đang `submitted` | Quân tự bấm "Chấp thuận" | Quân 2201110201 | Bị từ chối, vì người lập không tự duyệt và chỉ Văn phòng được duyệt. DB giữ `submitted` | 403 `FORBIDDEN`. DB `submitted` | Pass |
| TC-UCB-02 | UC-B | Như trên | Mai chọn "Yêu cầu chỉnh sửa" với lý do quá ngắn | `request_changes`, lý do "Thiếu" (5 ký tự) | 422 `VALIDATION_ERROR` ở trường `reason` (cần ≥ 10 ký tự). DB giữ `submitted` | 422, `reason`: "Yêu cầu chỉnh sửa hoặc từ chối phải ghi lý do (tối thiểu 10 ký tự).". DB `submitted` | Pass (lần 1 Fail do dữ liệu test, xem trên) |
| TC-UCB-03 | UC-B | Như trên | Mai bấm "Chấp thuận" | Mai 2201110202 | 200 `approved`. DB `approved` | 200 "Đã chấp thuận kế hoạch.". DB `approved` | Pass |
| TC-UCC-01 | UC-C | "Hiến máu" đang mở đăng ký: không cần duyệt, chỉ tiêu 150, đối tượng là mọi SV HIU. Phúc chưa đăng ký | Phúc bấm "Đăng ký" | Phúc 2241110104 (Khoa Dược) | 201 `accepted`. DB có 1 đăng ký `accepted` | 201 "Đăng ký thành công…". DB `accepted` | Pass |
| TC-UCC-02 | UC-C | "Workshop CV": chỉ tiêu 2, đã đủ 2 đăng ký, đối tượng Khoa CNKT | Hân (Khoa CNKT) bấm "Đăng ký" | Hân 2211110103 | Bị từ chối vì hết chỗ. DB vẫn 2 đăng ký | 409 `REGISTRATION_FULL` "Chương trình đã đủ chỗ cho nhóm của bạn.". DB 2 | Pass |
| TC-UCC-03 | UC-C | "Workshop CV" chỉ dành cho Khoa CNKT | Phúc (Khoa Dược) bấm "Đăng ký" | Phúc 2241110104 | Bị từ chối vì không thuộc đối tượng. DB không có đăng ký | 403 `AUDIENCE_NOT_MET`. DB 0 | Pass |
| TC-UCC-04 | UC-C | "Mùa hè xanh" cần BTC duyệt. Đăng ký của Hân đang `pending` | Quân (BTC, Đoàn Khoa sở hữu) bấm "Duyệt" | Đăng ký của Hân | 200 `accepted`. DB `accepted` | 200 "Đã duyệt đăng ký.". DB `accepted` | Pass |
| TC-UCD-01 | UC-D | "Hiến máu" đã chấp thuận; An có đăng ký `accepted`. Quân lưu kế hoạch điểm danh (cộng điểm từng lượt: sáng 2, chiều 3, tối đa 5), mở lượt "Buổi sáng" và phát QR | An gửi điểm danh bằng token QR còn hạn | `sessionId` và token vừa phát | 201 điểm danh lượt "Buổi sáng". Điểm dự kiến đề nghị = 2 | 201 "Đã điểm danh lượt "Buổi sáng".". `attendance_expected_points` = 2 | Pass |
| TC-UCD-02 | UC-D | An vừa điểm danh lượt sáng | An quét lại cùng mã | Token cũ, còn hạn | Bị từ chối vì đã điểm danh. DB vẫn 1 bản ghi | 409 `ALREADY_CHECKED_IN`. DB 1 bản ghi | Pass |
| TC-UCD-03 | UC-D | Hân không có đăng ký "Hiến máu" | Hân quét QR lượt sáng | Token còn hạn | Bị từ chối vì chưa có đăng ký được nhận | 403 `REGISTRATION_NOT_ACCEPTED` | Pass |
| TC-UCD-04 (K1) | UC-D | Lượt đang mở; Ngọc có đăng ký `accepted`; **chưa đăng nhập** | 1. Mở link QR `/attend/<id>?t=<token>`. 2. Bị chuyển tới trang đăng nhập. 3. Đăng nhập | Ngọc 2211110102 | Chuyển tới `/login?next=<đường dẫn kèm ?t=>`. Sau đăng nhập, API trả `next` là đúng link QR để quay lại điểm danh | 307 → `/login?next=%2Fattend%2F<id>`, **mất `?t=`**. Đăng nhập trả `next: "/onboarding/profile"` | **Fail**, Bug #28 |
| TC-UCD-05 | UC-D | Token QR phát hơn 30 giây trước | Ngọc gửi điểm danh bằng token cũ | Token phát lúc chuẩn bị, chờ 31 giây | Bị từ chối vì mã hết hạn, kiểm theo giờ server | 410 `QR_EXPIRED` "Mã QR đã hết hiệu lực…" | Pass |

Tổng: 15 test case (UC-A 3, UC-B 3, UC-C 4, UC-D 5). Lần 2 có 14 Pass, 1 Fail (K1 → Bug #28).

## Automated test chạy trên CI

| Test | UC | Cách tự chuẩn bị dữ liệu | Chạy ở |
|---|---|---|---|
| pgTAP `supabase/tests/002_authorization_workflow.sql` | UC-A (công nhận Đoàn viên, Sổ Đoàn, CTV không được duyệt cuối) | Mỗi file chạy trong `begin … rollback`, tự tạo tài khoản và vai trò bằng UUID cố định trong transaction | Job `pgtap` |
| pgTAP `005_event_programs.sql` | UC-B (nộp, duyệt, không tự duyệt hồ sơ mình nộp, lý do trả sửa) | Như trên | Job `pgtap` |
| pgTAP `007_program_registrations.sql` | UC-C (đối tượng, chỉ tiêu, BTC duyệt, uy tín) | Như trên | Job `pgtap` |
| pgTAP `008_program_attendance.sql` | UC-D (token ký HMAC, hạn 30 giây, trùng lượt, điểm dự kiến) | Như trên | Job `pgtap` |
| Vitest `tests/*.test.ts` (validation, quyền hiển thị, lý do không đăng ký được, cấu hình) | UC-B, UC-C, UC-D ở tầng TypeScript | Dữ liệu tạo trong từng test, không dùng DB | Job `build-test` |

pgTAP chạy trên CI từ PR #24, tổng 205 assertion trong 8 file. Các file độc lập với nhau, vì mỗi file rollback toàn bộ dữ liệu của mình. Vì vậy kết quả không phụ thuộc thứ tự chạy.

Checklist smoke test: [`docs/testing/smoke-test.md`](../testing/smoke-test.md).
