# Bằng chứng kiểm thử CR-01 — TH4

Ngày chạy: 10/11/2026. Môi trường: bản build production của nhánh
`cr/CR-01-TaiKhoanToChuc`, stack Supabase tách biệt `eoffice-cr01-spike`
(cổng 573xx). Không áp migration lên stack dev chính.

## 1. Kết quả tự động

| Bộ kiểm thử | Trạng thái | Kết quả thật | Log |
|---|---|---:|---|
| pgTAP, công tắc TẮT | PASS | 8 file, 205/205 assertion | `final/pgtap-off.log` |
| pgTAP, công tắc BẬT | PASS | 10 file, 306/306 assertion | `final/pgtap-on.log` |
| Vitest + coverage | PASS | 17 file, 203/203 test | `final/vitest-coverage.log` |
| Lint | PASS | exit 0 | `final/lint.log` |
| Typecheck | PASS | exit 0 | `final/typecheck.log` |
| Next production build | PASS | 69 trang tĩnh | `final/build.log` |
| Test case TH2 + AC6 | PASS | 19/19 (15 hồi quy + 4 AC6 UC-A/B/C/D) | `final/test-cases.log` |
| Smoke test | PASS | 8/8 bước | `final/smoke-curl.log`, `final/smoke-playwright.log`, `smoke/` |

Coverage Vitest toàn `src/`: statements 18,70% (654/3496), branches 15,88%
(482/3034), functions 21,45% (177/825), lines 19,58% (554/2828). Nghiệp vụ
PostgreSQL không nằm trong số đo v8; phần này được bảo vệ bằng 306 assertion pgTAP.

## 2. Ma trận truy vết AC1–AC14 (Phụ lục A.1)

| AC | Kiểm thử tự động / thủ công | Kết quả | Bằng chứng chính |
|---|---|---|---|
| AC1 | pgTAP 010; Vitest `organization-auth`, `auth-ui`; đăng nhập Đoàn Khoa | PASS | `final/pgtap-on.log`, `final/vitest-coverage.log`, `functional/02-faculty-admin.png` |
| AC2 | pgTAP 010 kiểm danh sách/nhóm đơn vị | PASS | `final/pgtap-on.log` |
| AC3 | pgTAP 009 chặn `class_union`, không khóa vĩnh viễn `school_committee` trong thiết kế | PASS | `final/pgtap-on.log` |
| AC4 | pgTAP 010 kiểm lỗi chung và PIN giả; Playwright sai PIN | PASS | `final/pgtap-on.log`, `functional/01-login-error.png` |
| AC5 | pgTAP 010 kiểm 5 lần/15 phút, tách theo đơn vị và IP | PASS | `final/pgtap-on.log` |
| AC6 | pgTAP ở cả TẮT/BẬT; bốn test API UC-A/B/C/D kiểm 403 và DB không đổi | PASS | `final/pgtap-off.log`, `final/pgtap-on.log`, `final/test-cases.log` |
| AC7 | pgTAP 010 kiểm biên đơn vị và CTV cá nhân | PASS | `final/pgtap-on.log` |
| AC8 | pgTAP 010 kiểm tự duyệt theo cán bộ và audit đơn vị+cán bộ | PASS | `final/pgtap-on.log` |
| AC9 | Vitest `nav-access`; Playwright menu theo Đoàn Khoa/Văn phòng/Đoàn Trường và phân luồng TẮT | PASS | `final/vitest-coverage.log`, `functional/02-faculty-admin.png`, `05-office-review.png`, `07-school-accounts.png`, `08-feature-off-personal-fallback.png` |
| AC10 | pgTAP 010; Playwright tạo/đặt lại PIN/khóa/mở/đổi PIN; script bootstrap chạy một lần | PASS | `final/pgtap-on.log`, `functional/07-school-accounts.png` |
| AC11 | 203 Vitest, pgTAP TẮT 205 assertion cũ, 15 test case TH2 và smoke UC-C | PASS | `final/`, `smoke/01-registration-success.png` |
| AC12 | pgTAP 010 và Vitest kiểm phiên tạm 5 phút, chỉ dùng một lần, chưa qua bước 2 không quản lý được | PASS | `final/pgtap-on.log`, `final/vitest-coverage.log` |
| AC13 | pgTAP 010; Playwright đổi từ Quân sang Ngọc không nhập lại PIN tổ chức | PASS | `final/pgtap-on.log`, `functional/04-faculty-switched-officer.png` |
| AC14 | pgTAP 010 kiểm RLS/RPC không đọc/ghi khi thiếu cán bộ và token cũ bị thu hồi | PASS | `final/pgtap-on.log` |

## 3. Bảng kết quả chức năng và hồi quy (Phụ lục A.2)

| Mã | Loại | Kịch bản | Kết quả | Bằng chứng |
|---|---|---|---|---|
| FT-LOGIN-ERROR | Lỗi | Sai PIN tổ chức trả cùng thông báo chung | PASS | `functional/01-login-error.png` |
| FT-FACULTY | Chính/biên | Đoàn Khoa mở chương trình, biểu mẫu, đổi PIN rồi đổi cán bộ | PASS | `functional/02`–`04` |
| FT-OFFICE | Chính | Văn phòng duyệt kế hoạch và hồ sơ Đoàn viên | PASS | `functional/05`–`06` |
| FT-SCHOOL | Chính/biên | Đoàn Trường tạo, đặt lại PIN, khóa và mở tài khoản tổ chức | PASS | `functional/07-school-accounts.png` |
| FT-FLAG-OFF | Hồi quy | Tắt công tắc: `/admin` bị chặn, tài khoản cá nhân quản lý như v1.0.0 | PASS | `functional/08-feature-off-personal-fallback.png` |
| TC-AC6-UCA..D | Hồi quy/bảo mật | Khi bật, grant cá nhân không quản lý UC-A/B/C/D; DB không đổi | PASS 4/4 | `final/test-cases.log` |
| TC-UCA..D | Hồi quy TH2 | Các luồng chính, lỗi và biên UC-A/B/C/D bằng phiên tổ chức | PASS 15/15 | `final/test-cases.log` |
| SMOKE-01..08 | Smoke | Khởi động, DB, route bảo vệ, đăng nhập, UC-C, đăng xuất | PASS 8/8 | `final/smoke-*.log`, `smoke/` |

`functional/results.json` và `smoke/results.json` là kết quả máy đọc được. Tám ảnh
chức năng và hai ảnh smoke đều được mở xem lại sau khi chụp; chúng là giao diện thật
trên bản build production và chỉ chứa dữ liệu demo giả.

## 4. RED trước GREEN

- Điều chỉnh AC6: `cr01-ac6-red/README.md` — 95 assertion, 82 FAIL đúng vì chưa có
  feature flag và chưa vô hiệu grant cá nhân khi bật.
- Trạng thái RED ban đầu: `cr01-red-before-green/` — pgTAP/Vitest thất bại tại các
  thành phần CR-01 chưa hiện thực.
- Test liên kết con `/admin` và trang/đường đổi PIN được commit RED riêng trước các
  commit GREEN tương ứng; lịch sử commit là bằng chứng thứ tự.

## 5. Seed demo và an toàn dữ liệu

`final/seed-demo.log` và `final/seed-demo-verification.log` chứng minh seed sạch tạo
3 tài khoản tổ chức, giữ 3 grant quản lý cá nhân và 11/11 dòng lịch sử chương trình
ghi tài khoản tổ chức kèm cán bộ. PIN tổ chức chỉ nhận qua biến môi trường và không
ghi vào log. `final/seed-demo-refusal.log` chứng minh script từ chối seed lại DB đã có
dữ liệu.
