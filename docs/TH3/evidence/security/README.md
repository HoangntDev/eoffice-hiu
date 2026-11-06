# Nâng cấp bảo mật next và zod (issue #63)

Ngày: 06/11/2026. Phạm vi: bản vá cho v1.0.1.

| Gói | Trước | Sau | Mức | Advisory |
|---|---|---|---|---|
| `next` | 16.3.8 | 16.4.5 | critical | GHSA-2464-fhr4-w9xw (RCE ở Image Optimization API với SVG), GHSA-p3m5-59mp-jv5r (DoS Server Actions), GHSA-673q-mjm6-r5xr (RCE ở `use cache`); khoảng ảnh hưởng `16.0.0 - 16.4.0` |
| `zod` | 4.6.5 | 4.6.7 | high | GHSA-mrhx-c7xc-m3w5 (cạn bộ nhớ khi kiểm collection lớn); khoảng ảnh hưởng `<4.6.6` |
| `eslint-config-next` (dev) | 16.3.8 | 16.4.5 | – | Nâng cùng `next` |

Phiên bản được pin chính xác trong `package.json`.

## Kết quả `npm audit`

| | Tổng | critical | high | moderate |
|---|---|---|---|---|
| Trước (`npm-audit-before.txt`) | 15 | 1 | 3 | 11 |
| Sau (`npm-audit-after.txt`) | 13 | 0 | 2 | 11 |
| Sau, chỉ dependency chạy production (`npm audit --omit=dev`) | 0 | 0 | 0 | 0 |

13 lỗ hổng còn lại đều nằm trong công cụ phát triển, không có trong bản chạy production: `vitest`/`@vitest/*`, `vite` (qua vitest), `undici` (qua jsdom, chỉ dùng khi test), `minimatch` (qua `typescript-eslint` của `eslint-config-next`). Ngoài phạm vi issue này, cần issue riêng; phần lớn phải nâng phiên bản lớn (`npm audit fix --force`).

## Kiểm tra sau nâng cấp

- `npm run lint`, `npm run typecheck`: sạch.
- `npx vitest run`: 16 file, 177 test PASS.
- `npm run build` (Next.js 16.4.5, Turbopack): sạch. Đã xem lại chunk proxy đã biên dịch: điều kiện của `optionalPublicSupabaseEnv()` (sửa ở INC-01) vẫn được giữ.
- Smoke test trên gói phát hành v1.0.1 ghi ở bằng chứng phát hành.
