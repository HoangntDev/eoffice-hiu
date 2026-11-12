# Chạy thật PayPal sandbox (13/11/2026)

Môi trường: worktree tách biệt tại `f6e91a2`, stack Supabase `eoffice-payment-final` (cổng 583xx,
không phải stack dev 543xx), `next start` tại `http://127.0.0.1:3100`, `PAYMENT_PROVIDER=paypal`,
PayPal REST sandbox, tỷ giá thử cho 24.000 đ = 0,96 USD. Dữ liệu demo giả (`docs/TH2/demo-data.md`);
MSSV trong log và file đối chiếu che dạng `221***01`.

Nguồn số liệu:

- `db-reconcile.log`: truy vấn DB sau khi chạy, cùng trạng thái 3 order đầu đọc lại từ PayPal sandbox.
- `app-payment-events.log`: 9 sự kiện `payment.*` trích nguyên văn từ log app.
- `../screenshots/`: ảnh màn hình thật do người phụ trách tự chụp trên Cốc Cốc (ẩn danh).

## Kịch bản và người thao tác thực tế

| # | Giờ VN | Thao tác | Tài khoản app | Kết quả (DB) | Ảnh |
|---|---|---|---|---|---|
| 1 | 22:28:30 (12/11) | Bật `PAYMENT_ENABLED` trên `/admin/accounts` | Đoàn Trường, cán bộ `999***99` | audit #252 `feature_flag.updated` false → true | 01 |
| 2 | 04:57:21 | Tạo khoản thu 2026, mức 2.000 đ/tháng (24.000 đ/năm). Tạo lần hai cho cùng năm bị chặn: "Khoa đã có khoản thu cho năm này" | Đoàn Khoa CNKT, cán bộ `220***01` | audit #255 `union_fee.campaign_created` | 02 |
| 3 | 05:12:57 | SV1 tạo đơn, chuyển sang PayPal | SV `221***01` (Nguyễn Văn An) | đơn `UF20264B7D62E83C5A4252A448`, order `3PV76443SW464614J` (#257, #258) | 03 |
| 4 | 05:15:35 | Đăng nhập nhầm tài khoản PayPal **Business** (merchant): PayPal báo "This PayPal account is associated with the merchant you're trying to pay", chọn quay về | SV `221***01` | đơn → **cancelled**, không capture, 0 dòng tháng (#259) | 04 |
| 5 | 05:15:46 | SV1 bấm thanh toán lại rồi bỏ dở | SV `221***01` | đơn `UF202690355809966147A7BBBD` pending (#260, #261), hết hạn lúc 05:31:27 → **expired** (#267) | — |
| 6 | 05:16:34 | Tạo đơn, thanh toán bằng tài khoản PayPal **Personal**; bấm "thanh toán" lần nữa thì dùng lại đơn đang chờ, không tạo đơn mới | SV `220***01` (Lê Minh Quân, sinh viên CNKT) | đơn `UF202628FDAD6459B74AF68793` → **paid** 05:17:43, capture `6R820438LF665854E` COMPLETED, **12 dòng tháng** (#262–#265) | 05, 06 |
| 7 | 05:21 | Đoàn Khoa xuất CSV (lúc này 1 người đã đóng) | Đoàn Khoa CNKT | — | 09 |
| 8 | 05:31:27 | SV1 thanh toán lại bằng tài khoản Personal | SV `221***01` | đơn `UF2026EADBFBB5F3E94EDA87A3` → **paid** 05:31:53, capture `72G57248YA062632S` COMPLETED, **12 dòng tháng** (#268–#271) | 07 |
| 9 | 05:32 | Đoàn Khoa xem danh sách: 2 người đã đóng tháng 1–12, đủ mã giao dịch | Đoàn Khoa CNKT | — | 08 |

Chuỗi **hủy → thanh toán lại thành công** xảy ra trên cùng sinh viên `221***01` (bước 3–5–8).
Sinh viên `220***01` thanh toán thành công ngay lần đầu (bước 6).

## Hai giao dịch thành công

| Mục | `220***01` | `221***01` |
|---|---|---|
| Mã đơn | `UF202628FDAD6459B74AF68793` | `UF2026EADBFBB5F3E94EDA87A3` |
| PayPal order | `4MM25966VT6758148` | `21S969393H886822N` |
| Mã giao dịch (capture) | `6R820438LF665854E` | `72G57248YA062632S` |
| Số tiền | 24.000 đ = 0,96 USD | 24.000 đ = 0,96 USD |
| Thời gian ghi nhận | 05:17:43 13/11/2026 | 05:31:53 13/11/2026 |
| Dòng tháng | 12 (tháng 1–12, không trùng) | 12 (tháng 1–12, không trùng) |
| Audit | #264 `payment_paid`, #265 `paypal_capture_recorded` | #270 `payment_paid`, #271 `paypal_capture_recorded` |

## Kết quả kiểm DB và log

- `provider_capture_id` = `transaction_ref` = mã giao dịch hiện trên biên nhận và trong danh sách, CSV.
- `custom_id` của mọi order PayPal khớp `order_ref`; currency USD, số tiền 0,96 khớp giá trị đã tính.
- Đơn hủy và đơn hết hạn không có capture và không có dòng tháng.
- Log app: grep `access_token|client_secret|bearer|password` trả 0 dòng; không có chuỗi 10 chữ số
  (MSSV đầy đủ) trong `app-payment-events.log` và `db-reconcile.log`.
- Audit của đơn sinh viên ghi `organization_id` của Đoàn Khoa sở hữu khoản thu; cột cán bộ để trống vì
  người thao tác là sinh viên.

## Ghi nhận ngoài luồng thanh toán

- Đơn mới được tạo với giá trị mặc định `provider = vnpay`, rồi gắn PayPal khoảng 2 giây sau
  (audit `order_created` → `paypal_order_bound`). Không ảnh hưởng ghi nhận.
- CSV ghi cột "Ngày đóng" dạng ISO UTC (`2026-11-12T22:17:43+00:00`), còn giao diện hiện giờ VN.
- Trong lúc chạy gặp hai lỗi có từ v1.1.0: đăng xuất kẹt (#84, thấy trong ảnh 01) và lỗi 500 khi
  trình duyệt còn cookie của phiên đã bị thu hồi (#85). Cả hai sửa sau v1.2.0.
