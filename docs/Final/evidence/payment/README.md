# Bằng chứng thanh toán Đoàn phí (#81)

Thời điểm chốt cục bộ gần nhất: 2026-11-12 20:54:41 +0700. Nhánh
`feat/81-online-payment`; commit mã nguồn được kiểm tra từ đầu trên stack tách biệt:
`70ffb2a`. Stack dùng project ID riêng và dải cổng 593xx, không áp migration lên
stack phát triển 543xx.

## RED

- RED ban đầu: Vitest 19/19 test thất bại vì `NOT_IMPLEMENTED`; pgTAP có 43/44
  assertion thất bại vì chưa có migration thanh toán. Một assertion hồ sơ cũ đạt,
  xác nhận fixture vẫn chạy đến cuối.
- RED bổ sung khi review biên IPN: Vitest thất bại 1/20 vì payload ký đúng nhưng
  thiếu `vnp_TmnCode` vẫn được nhận; pgTAP thất bại 4/46 sau khi IPN thành công
  thiếu mã giao dịch bị ghi nhận. Hai trường hợp đã có commit test riêng trước
  commit sửa.
- RED urlencode: Vitest thất bại 1/21 vì production dùng `%20`, khác vector
  `ksort` + PHP `urlencode` + HMAC-SHA512 độc lập dùng dấu `+` cho khoảng trắng.
- RED mã đơn hết hạn: pgTAP thất bại 6/51, trong đó đơn quá 15 phút vẫn giữ cùng
  `order_ref`, không chuyển `expired`, IPN vẫn ghi đủ 12 tháng và hai assertion
  audit phản ánh các ghi sai kéo theo.
- RED PayPal: commit `69c9c8b` làm Vitest dừng ở bước nạp vì ba module PayPal chưa
  tồn tại. pgTAP chạy đủ 70 assertion, thất bại 18 assertion PayPal do thiếu sáu
  cột và hai RPC mới; lần chạy đầu cũng phát hiện plan ghi nhầm 69 thay vì 70 và
  được sửa bằng commit test riêng `e55f6df` trước GREEN.

## GREEN và hồi quy

| Kiểm tra | Kết quả thật |
|---|---:|
| ESLint | PASS |
| TypeScript | PASS |
| Vitest + coverage | 19 file, 233/233 test PASS |
| pgTAP, hai công tắc TẮT | 8 file, 205/205 assertion cũ PASS |
| pgTAP, `ORG_ACCOUNTS_ENABLED` và `PAYMENT_ENABLED` BẬT | 11 file, 376/376 assertion PASS |
| Next.js production build | PASS, 79 trang |
| Database advisors | 17 cảnh báo cũ; 0 cảnh báo liên quan thanh toán |

Log đã thay đường dẫn máy bằng `<repo>`:

- `lint.log`, `typecheck.log`, `vitest-ci.log`, `build.log`
- `pgtap-off.log`, `pgtap-on.log`
- `advisors-summary.log`

## Sandbox thật

`sandbox-env-presence.log` chỉ ghi trạng thái có/thiếu, không đọc ra giá trị.
Bảy biến `PAYMENT_PROVIDER` và `PAYPAL_*` hiện đều thiếu. Phần FakeGateway, pgTAP,
lint, typecheck và build đã hoàn tất; chưa gọi PayPal API. Cần người phụ trách điền
biến trong `.env.local` và đăng nhập tài khoản Personal sandbox để chạy luồng thật.

Trang đăng ký `https://sandbox.vnpayment.vn/devreg/` đang trả 404 từ 11/11 đến lần
kiểm tra 12/11/2026; bốn biến `VNP_*` cũng thiếu. Theo chỉ đạo, không mở tunnel,
không tạo ảnh sandbox, không merge, tag hoặc phát hành trước khi chạy thật.
