# Bằng chứng thanh toán Đoàn phí (#81)

Thời điểm chốt cục bộ gần nhất: 2026-11-13 (chạy thật PayPal sandbox). Nhánh
`feat/81-online-payment`. RED/GREEN ban đầu kiểm trên `70ffb2a` (stack 593xx); hồi quy và
chạy thật kiểm trên `f6e91a2` (stack `eoffice-payment-final`, cổng 583xx). Không áp
migration lên stack phát triển 543xx.

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

Chạy lại ngày 12/11/2026 (21:45–21:52 +0700) trên commit `f6e91a2`:

| Kiểm tra | Kết quả thật |
|---|---:|
| ESLint | PASS (exit 0) |
| TypeScript | PASS (exit 0) |
| Vitest + coverage | 19 file, 235/235 test PASS |
| pgTAP, hai công tắc TẮT | 8 file, 205/205 assertion cũ PASS |
| pgTAP, `ORG_ACCOUNTS_ENABLED` và `PAYMENT_ENABLED` BẬT | 11 file, 376/376 assertion PASS |
| Next.js production build | PASS, 79 trang |
| Database advisors (lần chạy trước, `70ffb2a`) | 17 cảnh báo cũ; 0 cảnh báo liên quan thanh toán |

pgTAP chạy trên một Postgres trắng tách biệt (`supabase db start`, giống CI). Khi chạy
trên stack đã seed dữ liệu demo, pgTAP bật có 4/75 assertion của `010` thất bại (ca
23–25, 38). Nguyên nhân là dữ liệu demo tạo thêm tài khoản tổ chức Đoàn Khoa CNKT, nên
dropdown có 4 đơn vị thay vì 3; đây không phải lỗi code.

Log đã thay đường dẫn máy bằng `<repo>`:

- `lint.log`, `typecheck.log`, `vitest-ci.log`, `build.log`
- `pgtap-off.log`, `pgtap-on.log`
- `advisors-summary.log`

## Sandbox thật (PayPal)

- `sandbox-env-presence.log`: chỉ ghi có hoặc thiếu, không ghi giá trị. OAuth sandbox
  trả HTTP 200; `/api/health` trả 200 với version 1.2.0.
- `sandbox-run/README.md`: kịch bản, người thanh toán thực tế, mã đơn, mã giao dịch
  PayPal, số tiền VND/USD, kết quả đối chiếu DB, audit và log.
- `sandbox-run/db-reconcile.log`, `sandbox-run/app-payment-events.log`: số liệu gốc
  (MSSV che dạng `221***01`).
- `screenshots/`: ảnh do người phụ trách tự chụp.

Trang đăng ký `https://sandbox.vnpayment.vn/devreg/` trả 404 trong ngày 11–12/11/2026,
nên không có mã merchant VNPay; luồng thật dùng PayPal sandbox. `VnpayGateway` và
toàn bộ test VNPay giữ nguyên.
