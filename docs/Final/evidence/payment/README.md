# Bằng chứng thanh toán Đoàn phí (#81)

Thời điểm chốt cục bộ: 2026-11-11 06:04:41 +0700. Nhánh
`feat/81-online-payment`; commit mã nguồn được kiểm tra từ đầu trên stack tách biệt:
`a34d364`. Stack dùng project ID riêng và dải cổng 593xx, không áp migration lên
stack phát triển 543xx.

## RED

- RED ban đầu: Vitest 19/19 test thất bại vì `NOT_IMPLEMENTED`; pgTAP có 43/44
  assertion thất bại vì chưa có migration thanh toán. Một assertion hồ sơ cũ đạt,
  xác nhận fixture vẫn chạy đến cuối.
- RED bổ sung khi review biên IPN: Vitest thất bại 1/20 vì payload ký đúng nhưng
  thiếu `vnp_TmnCode` vẫn được nhận; pgTAP thất bại 4/46 sau khi IPN thành công
  thiếu mã giao dịch bị ghi nhận. Hai trường hợp đã có commit test riêng trước
  commit sửa.

## GREEN và hồi quy

| Kiểm tra | Kết quả thật |
|---|---:|
| ESLint | PASS |
| TypeScript | PASS |
| Vitest + coverage | 18 file, 223/223 test PASS |
| pgTAP, hai công tắc TẮT | 8 file, 205/205 assertion cũ PASS |
| pgTAP, `ORG_ACCOUNTS_ENABLED` và `PAYMENT_ENABLED` BẬT | 11 file, 352/352 assertion PASS |
| Next.js production build | PASS, 77 trang |
| Database advisors | 17 cảnh báo cũ; 0 cảnh báo liên quan thanh toán |

Log đã thay đường dẫn máy bằng `<repo>`:

- `lint.log`, `typecheck.log`, `vitest-ci.log`, `build.log`
- `pgtap-off.log`, `pgtap-on.log`
- `advisors-summary.log`

## Sandbox thật

`sandbox-env-presence.log` chỉ ghi trạng thái có/thiếu, không đọc ra giá trị.
Cả bốn biến `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL` hiện
đều thiếu. Vì vậy chưa mở tunnel, chưa chạy thẻ sandbox, chưa tạo ảnh luồng thật,
chưa merge, tag hoặc phát hành. Việc này tuân theo mốc dừng được giao: hoàn tất
FakeGateway và mở PR trước khi xin thông tin/ủy quyền cho tunnel.
