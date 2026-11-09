# Bằng chứng lỗi #61 – token QR sai định dạng UUID trả 500

Issue #61 (Bug report, Milestone TH3), PR #62.

| Bước | Tệp | Kết quả |
|---|---|---|
| RED local | `red-vitest.log` | `tests/qr-token-invalid.test.ts`: 4 failed, 1 passed (5). Ví dụ `expected 500 to be 422`, `VALIDATION_ERROR` thay vì `QR_INVALID` |
| RED CI | `red-ci-run-42154168599.log` | Commit `5f0061e`: `build-test` đỏ, 4 failed \| 173 passed (177) |
| GREEN local | `green-vitest.log` | 5 passed (5) |
| GREEN CI | `green-ci-run-42154363218.log` | Commit `fbf7329`: xanh |
| Gói v1.0.1 | `v1.0.1-kiem-tra.log` | Token `0…0.1.1700000000000.0…0` và `abc` → 422 `QR_INVALID` |

Phát hiện khi trích log cho Việc 1 (`docs/TH3/evidence/logging/`), trên stack tách biệt `eoffice-v100`, dữ liệu demo giả.
