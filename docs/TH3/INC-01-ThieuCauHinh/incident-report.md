# Incident Report – INC-01-ThieuCauHinh

Ngày: 06/11/2026. Issue sự cố: #59 (Bug report, loại "Sự cố vận hành (INC)", label `incident`, Milestone TH3). Hotfix: PR #60. Phát hành: [v1.0.1](https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0.1).

Môi trường: gói v1.0.0 cài ngoài repo (`~/Developer/eoffice-smoke-v1.0.0`), stack Supabase tách biệt `eoffice-v100` (cổng 563xx), dữ liệu demo giả, web cổng 3300. Không đụng DB local đang dùng, không đụng Supabase cloud. Mọi thời điểm là giờ máy (+07) trừ khi ghi UTC. Bằng chứng: [`evidence/`](evidence/).

| Mục | Nội dung |
|---|---|
| Incident ID | INC-01-ThieuCauHinh |
| Mô tả sự cố | v1.0.0 khởi động và báo `Ready` dù thiếu hoặc sai cấu hình bắt buộc; lỗi chỉ lộ ra khi người dùng thao tác. Ba trường hợp: **K1a** thiếu `AUTH_RATE_LIMIT_PEPPER`; **K1b** `SUPABASE_SERVICE_ROLE_KEY` sai; **K1c** thiếu `NEXT_PUBLIC_SUPABASE_URL` |
| Ảnh hưởng | K1a: không ai đăng nhập được (503 "Dịch vụ chưa được cấu hình biến môi trường."). K1b: không ai đăng nhập được (500 "Không thể xử lý yêu cầu. Vui lòng thử lại."). K1c: **toàn bộ** trang và API, kể cả trang chủ và `/login`, trả "Internal Server Error" thô. Không mất hay hỏng dữ liệu (số bản ghi khớp bản sao lưu trước sự cố) |
| Phát hiện và bằng chứng | v1.0.0 **không có log** cho K1a, K1b (console chỉ có dòng `Ready`), không có `/api/health` (404). K1c chỉ có stack trace "Your project's URL and Key are required…" trên console. Thời điểm "phát hiện" đo ở phần A là lúc tôi **mô phỏng người dùng thao tác ngay** sau khi khởi động; thực tế chỉ phát hiện được khi có người dùng báo. Ảnh và log: `evidence/a-v1.0.0/` |
| Nguyên nhân gốc | Không có bước kiểm tra cấu hình bắt buộc lúc khởi động, và không có test cho đường "cấu hình thiếu/sai". Chi tiết ở mục 5 Whys |
| Cách khắc phục | Khôi phục nhanh: trả `.env.local` từ bản dự phòng chép trước sự cố, khởi động lại, kiểm tra đăng nhập (dữ liệu không hỏng nên không cần `scripts/restore.sh`). Khắc phục triệt để: hotfix `hotfix/INC-01-ThieuCauHinh` (RED `57eb927` → GREEN `96705c9`, PR #60), phát hành v1.0.1 |
| Kiểm chứng | 10 test tái hiện chuyển từ RED (9 failed) sang GREEN; CI xanh. Lặp lại K1a/K1b/K1c trên gói v1.0.1 tải từ Release: lỗi bị ghi `config.invalid` 1–2 giây sau khởi động, `/api/health` trả 503 `config: error`, người dùng thấy câu thân thiện kèm mã tham chiếu. Smoke test 8/8 PASS trên gói v1.0.1 |
| Phòng ngừa | Trong hotfix: kiểm tra cấu hình khi khởi động, `/api/health` báo cấu hình, log có tên biến, trang 503 rõ ràng. Đề xuất ngoài phạm vi: xử lý mất kết nối database (K2), kiểm tra gói phát hành trong CI, giám sát `/api/health`… (mục Phòng ngừa) |

## Diễn biến từng trường hợp trên v1.0.0 (phần A)

Trước mỗi trường hợp: `scripts/backup.sh eoffice-v100` và chép `.env.local` ra bản dự phòng ngoài repo. Người dùng được mô phỏng bằng Playwright (tài khoản demo `2201110202`, PIN demo).

| | K1a – thiếu `AUTH_RATE_LIMIT_PEPPER` | K1b – `SUPABASE_SERVICE_ROLE_KEY` sai | K1c – thiếu `NEXT_PUBLIC_SUPABASE_URL` |
|---|---|---|---|
| Khởi động | `✓ Ready`, trang chủ 200 | `✓ Ready`, trang chủ 200, `/forms` 200 | `✓ Ready` |
| Người dùng thấy | Đăng nhập → 503 "Dịch vụ chưa được cấu hình biến môi trường." ([ảnh](evidence/a-v1.0.0/k1/1a-login.png)) | Đăng nhập → 500 "Không thể xử lý yêu cầu. Vui lòng thử lại." ([ảnh](evidence/a-v1.0.0/k1/1b-login.png)) | Mọi URL → 500, trang trắng chỉ có "Internal Server Error" ([ảnh](evidence/a-v1.0.0/k1/1c-login.png)) |
| Log (console, v1.0.0 không ghi file) | Không có dòng nào | Không có dòng nào | Stack trace `Error: Your project's URL and Key are required to create a Supabase client!`, 5 lần |
| Nguyên nhân trực tiếp | `rateLimitPepper()` ném `MISSING_ENV` khi có request đăng nhập; `apiError` trả 503 nhưng không log | Truy vấn `auth_attempts` bằng service role bị PostgREST từ chối (401 `PGRST301`); `enforceAuthRateLimit` ném lỗi chung → 500, không log | Bản build gộp phép kiểm tra trong `optionalPublicSupabaseEnv()` thành `let t={url:…,publishableKey:…};if(!t)` – điều kiện không bao giờ đúng – nên proxy vẫn tạo Supabase client với URL rỗng và ném lỗi ở mọi request; lỗi trong proxy không đi qua trang lỗi |

## Dòng thời gian

| Thời điểm | Sự kiện |
|---|---|
| 09:31:09 | Chuẩn bị K1: sao lưu `eoffice-v100_20261106T093109`, chép `.env.local`; chạy mốc chuẩn (đăng nhập 200) |
| **09:31:36** | **K1a bắt đầu:** `npm start` v1.0.0 thiếu `AUTH_RATE_LIMIT_PEPPER` |
| 09:31:44 | K1a phát hiện (mô phỏng): người dùng đăng nhập thấy 503 |
| 09:32:02 | K1a khắc phục: dừng web, trả `.env.local` |
| **09:32:11** | **K1a khôi phục:** đăng nhập lại 200 |
| **09:32:11** | **K1b bắt đầu:** `npm start` với service role key sai |
| 09:32:20 | K1b phát hiện (mô phỏng): đăng nhập 500 |
| 09:32:29 | K1b khắc phục: trả `.env.local` (`cmp` khớp bản gốc) |
| **09:32:38** | **K1b khôi phục:** đăng nhập lại 200 |
| 09:55:34 | Chuẩn bị K1c: sao lưu `eoffice-v100_20261106T095535` |
| **09:55:36** | **K1c bắt đầu:** `npm start` thiếu `NEXT_PUBLIC_SUPABASE_URL` |
| 09:55:40 | K1c phát hiện (mô phỏng): `/login` trả "Internal Server Error" |
| 09:55:48 | K1c khắc phục: trả `.env.local` |
| **09:55:56** | **K1c khôi phục:** đăng nhập lại 200 |
| 09:56:15 | Mở issue #59 (form Bug report, loại INC, label `incident`) |
| 09:58:11 | Commit RED `57eb927` (10 test, 9 thất bại ở assertion) |
| 10:00 | CI run `42153647144` đỏ ở bước test: 9 failed \| 163 passed (172) – đúng mong đợi |
| 10:00:48 | Commit GREEN `96705c9` |
| 10:02:52 | PR #60 merge (CI run `42153895101` xanh) |
| 10:07:44 | PR #62 merge: lỗi token QR (#61), không thuộc INC-01 nhưng vào cùng bản phát hành |
| 10:12:09 | PR #64 merge: `next` 16.4.5, `zod` 4.6.7 (#63) |
| 10:14:49 | PR #66 merge: CHANGELOG `[1.0.1]`, version 1.0.1 (#65); CI trên `main` (`fb5eb99`) xanh |
| 10:16:51 | Tag annotated `v1.0.1` trên `fb5eb99`, push; dựng gói từ worktree sạch tại tag (`BUILD-INFO`: 10:17:49) |
| 10:18:23 | Công bố GitHub Release v1.0.1 kèm gói và SHA-256 |
| 10:18–10:19 | Smoke test lần 1 trên gói tải từ Release: `npm start` thất bại `Cannot find module 'winston-592a0a42b673a90a'` – gói thiếu 2 symlink `.next/node_modules/winston-*` (lỗi đóng gói, không phải lỗi code) |
| 10:20 | Đóng gói lại bằng `zip -y`, thay tài sản trên Release (SHA-256 `0f4a744b…`), ghi chú việc thay trong release notes |
| 10:21 | Smoke test trên gói mới: **8/8 PASS**; `/api/health` = `{"app":"ok","db":"ok","config":"ok","version":"1.0.1"}` |
| 10:21:55–10:23:09 | Lặp lại K1a, K1b, K1c trên v1.0.1: cả ba bị phát hiện qua log 1–2 giây sau khởi động và khôi phục được |

### Thời gian phát hiện và khôi phục

| Trường hợp | v1.0.0: bắt đầu → phát hiện | v1.0.0: phát hiện → khôi phục | v1.0.1: bắt đầu → phát hiện | Cách phát hiện ở v1.0.1 |
|---|---|---|---|---|
| K1a | 8 giây (mô phỏng) | 27 giây | 1 giây (10:21:55 → log 03:21:56Z) | `config.invalid` lúc khởi động; `/api/health` 503 |
| K1b | 9 giây (mô phỏng) | 18 giây | 2 giây (10:22:18 → log 03:22:20Z) | `config.invalid` (thử khóa bị 403) lúc khởi động; `/api/health` 503 |
| K1c | 4 giây (mô phỏng) | 16 giây | 1 giây (10:22:44 → log 03:22:45Z) | `config.invalid` lúc khởi động; `/api/health` 503 |

**Đọc số liệu cho đúng:** cột "bắt đầu → phát hiện" của v1.0.0 chỉ đo được vì người dùng mô phỏng thao tác ngay sau khi khởi động. Ở vận hành thật, v1.0.0 không có log và không có health check, nên thời gian phát hiện bằng khoảng thời gian tới khi một người dùng gặp lỗi **và báo lại** – có thể vài phút tới vài giờ. Với K1a/K1b, người dùng đã đăng nhập trước đó vẫn dùng được, nên lỗi còn khó thấy hơn. Ở v1.0.1, thời gian phát hiện không phụ thuộc người dùng: dòng `config.invalid` xuất hiện ngay khi khởi động, và smoke test bước 1 (`/api/health`) bắt được trước khi mở cho người dùng.

Thời gian khôi phục đo được ngắn (16–27 giây) vì người khôi phục đã biết nguyên nhân và có sẵn bản dự phòng `.env.local`. Vẫn nằm rất xa trong RTO 30 phút của runbook.

## Phân tích 5 Whys

Áp dụng chung cho K1a, K1b, K1c.

1. **Vì sao người dùng không đăng nhập được, hoặc chỉ thấy "Internal Server Error"?**
   → Vì request cần một biến cấu hình bắt buộc đang thiếu hoặc sai: pepper (K1a), service role key (K1b), URL Supabase (K1c). *(Triệu chứng)*
2. **Vì sao ứng dụng vẫn chạy và nhận request khi cấu hình đã thiếu hoặc sai?**
   → Vì v1.0.0 chỉ đọc biến khi có request cần tới (`required()` trong `src/lib/env.ts`). Lúc khởi động không có bước nào kiểm tra, nên `npm start` vẫn báo `Ready`. *(Nguyên nhân trực tiếp)*
3. **Vì sao vận hành không biết, phải chờ người dùng báo?**
   → Vì `apiError` trả 503/500 mà không ghi log, không có `/api/health`, và log không ghi ra file. K1c chỉ để lại stack trace thô trên console.
4. **Vì sao K1c làm hỏng mọi trang thay vì chỉ báo lỗi rõ ràng như thiết kế (proxy "bỏ qua khi chưa cấu hình")?**
   → Vì bản build đã gộp mất phép kiểm tra trong `optionalPublicSupabaseEnv()`. Khi nội tuyến `runtime("NEXT_PUBLIC_…")`, trình biên dịch dùng giá trị lúc build để rút gọn điều kiện, nên hàm luôn trả object. Đoạn mã đúng trên giấy nhưng sai trong gói chạy thật, và lỗi ném trong proxy không đi qua trang lỗi hay `onRequestError`.
5. **Vì sao các lỗ hổng này lọt qua phát hành v1.0.0?**
   → Vì khi chuyển sang "build một lần, cấu hình lúc chạy" (#32), dự án không thêm bước xác thực cấu hình khi khởi động. Kiểm thử và smoke test chỉ chạy với cấu hình đúng; không có test nào cho đường "cấu hình thiếu/sai", và không ai kiểm tra hành vi trên bản build.

**Nguyên nhân gốc:** thiếu cơ chế kiểm tra cấu hình bắt buộc ngay khi khởi động, có tín hiệu cho vận hành (log, health check), và thiếu test cho các trường hợp cấu hình sai. Lỗi biên dịch ở K1c là điều kiện làm hậu quả nặng hơn, không phải gốc: nếu có kiểm tra lúc khởi động thì cấu hình sai đã bị chặn trước.

## Cách khắc phục

**Khôi phục nhanh** (mỗi trường hợp, theo runbook): dừng web → chép lại `.env.local` từ bản dự phòng (kiểm bằng `cmp`) → `npm start` → kiểm tra đăng nhập. Không cần rollback gói hay `scripts/restore.sh`, vì dữ liệu không bị ảnh hưởng (K2 kiểm số bản ghi so với bản sao lưu: chỉ `auth_attempts` tăng đúng số lần đăng nhập). Không có công tắc tắt tính năng (YC4) phù hợp, vì tính năng hỏng là đăng nhập.

**Khắc phục triệt để** – PR #60 (`hotfix/INC-01-ThieuCauHinh`):

| Commit | Nội dung |
|---|---|
| RED `57eb927` | `tests/inc-01-config.test.ts`, 10 test phủ K1a, K1b, K1c. Supabase được giả lập (YC2), không cần mạng. Khung `src/lib/config-check.ts` giữ hành vi v1.0.0 (không kiểm tra). Kết quả: 9 failed, 1 passed (test "`/api/health` vẫn đi qua proxy" đúng sẵn) |
| GREEN `96705c9` | `src/lib/config-check.ts`: kiểm tra 4 biến bắt buộc (có/không, URL đúng dạng), thử service role key với `GET /auth/v1/admin/users` (401/403 → `rejected`; không gọi được → chỉ cảnh báo). `src/instrumentation.ts` chạy kiểm tra khi khởi động, ghi `config.invalid` kèm **tên** biến, không ghi giá trị. `/api/health` thêm `config`, lỗi → 503 (không trả tên biến). `optionalPublicSupabaseEnv()` đọc biến qua vòng lặp nên bản build giữ nguyên điều kiện (đã kiểm trong `.next/server/chunks`). Proxy trả trang 503 "Hệ thống tạm thời chưa sẵn sàng" kèm mã tham chiếu (JSON với `/api/*`). Supabase từ chối khóa (401/403) → 503 `SERVICE_NOT_CONFIGURED` kèm mã tham chiếu và log `config.invalid` |

Quyết định thiết kế: **không chặn khởi động** khi cấu hình lỗi. K1a/K1b chỉ làm hỏng phần cần biến đó; người đã đăng nhập vẫn dùng được các chức năng khác. Bù lại, lỗi được báo ngay qua log và `/api/health`, và smoke test bước 1 dừng phát hành.

Kèm theo trong v1.0.1 (không thuộc INC-01): lỗi token QR (#61/PR #62), nâng `next`/`zod` (#63/PR #64). CHANGELOG `[1.0.1]` ghi đủ ba nhóm Fixed, Security, Added.

## Kiểm chứng

- **Test:** `tests/inc-01-config.test.ts` 10/10 PASS sau GREEN; toàn bộ Vitest 15 file, 172 test PASS; CI run `42153895101` xanh. Log RED/GREEN: `evidence/b-red-green/`.
- **Gói v1.0.1** (tải từ Release, SHA-256 `0f4a744b738fca7313772795c2d8336890c372a6bc683b4eb4ba5d7e613020e5`, cài vào thư mục mới, `npm ci`, cổng 3500): smoke test 8/8 PASS (`evidence/c-v1.0.1-phat-hanh/05-smoke.log`).
- **Lặp lại kịch bản trên v1.0.1** (`evidence/d-v1.0.1-lap-lai/`):

| | Log lúc khởi động | `/api/health` | Người dùng thấy | Sau khi trả cấu hình |
|---|---|---|---|---|
| K1a | `config.invalid` `AUTH_RATE_LIMIT_PEPPER: missing`; khi đăng nhập thêm `config.missing_env` có `reference` `acabfa96` | 503 `{"app":"error","db":"ok","config":"error"}` | "Hệ thống tạm thời chưa sẵn sàng do lỗi cấu hình… Mã tham chiếu: acabfa96." ([ảnh](evidence/d-v1.0.1-lap-lai/v101-K1a-login.png)) | health 200, đăng nhập được |
| K1b | `config.invalid` `SUPABASE_SERVICE_ROLE_KEY: rejected`; khi đăng nhập thêm `config.invalid` `reference` `b736a9a5` | 503 `{"app":"error","db":"ok","config":"error"}` | Cùng câu, mã `b736a9a5` thay vì 500 chung chung ([ảnh](evidence/d-v1.0.1-lap-lai/v101-K1b-login.png)) | health 200, đăng nhập được |
| K1c | `config.invalid` `NEXT_PUBLIC_SUPABASE_URL: missing`; mỗi request thêm `config.missing_env` từ proxy | 503 `{"app":"error","db":"error","config":"error"}` | Trang 503 "Hệ thống tạm thời chưa sẵn sàng" kèm mã `d37a4b5f` thay vì "Internal Server Error" thô ([ảnh](evidence/d-v1.0.1-lap-lai/v101-K1c-login.png)) | health 200, đăng nhập được |

Mã tham chiếu người dùng thấy trùng 8 ký tự đầu của `requestId` trong dòng log tương ứng.

## Phòng ngừa

**Đã làm trong hotfix:** kiểm tra cấu hình khi khởi động; `/api/health` báo `config`; log có tên biến (YC5: không ghi giá trị); thông báo thân thiện kèm mã tham chiếu; test tái hiện cho cả ba trường hợp chạy trong CI.

**Đề xuất ngoài phạm vi hotfix:**

1. **Mất kết nối database (K2) – chưa sửa.** Đã tái hiện trên v1.0.0 ở phần A (`evidence/a-v1.0.0/k2/`): dừng container `supabase_db_eoffice-v100` lúc **09:33:05** khi web đang chạy và người dùng đã đăng nhập.
   - 09:33:07: người dùng mở `/programs` bị đẩy về `/login` ([ảnh](evidence/a-v1.0.0/k2/2-programs.png)). Đăng nhập lại bị 500 "Không thể xử lý yêu cầu" ([ảnh](evidence/a-v1.0.0/k2/2-login.png)).
   - Console web v1.0.0: 0 dòng. Chỉ container Supabase có log: PostgREST `PGRST000`, Auth "failed to connect".
   - 09:33:25 `docker start`, DB healthy 09:33:35, **09:33:43** đăng nhập lại được mà **không cần khởi động lại web**. Phát hiện → khôi phục 36 giây.
   - Dữ liệu không mất: so với bản sao lưu 09:32:58, chỉ `auth_attempts` tăng 2.

   Nguyên nhân gốc sơ bộ: proxy và DAL coi "dịch vụ xác thực không gọi được" là "chưa đăng nhập", nên người dùng bị đẩy về trang đăng nhập với thông báo sai. Logging của v1.0.1 đã ghi được `db.call_failed` (thấy ở `docs/TH3/evidence/logging/`) và `/api/health` trả `db: error`, nhưng hành vi với người dùng chưa đổi. Đề xuất: phân biệt lỗi hạ tầng (5xx, lỗi mạng từ Supabase) với "chưa đăng nhập" trong `src/proxy.ts` và `src/lib/auth/dal.ts`; khi hạ tầng lỗi thì hiện trang "Hệ thống tạm gián đoạn" (503) và giữ phiên; thêm giới hạn thử lại. Đây là phần xác thực nhạy cảm về bảo mật (không được vô tình mở quyền khi lỗi), cần issue và test riêng, không gộp vào hotfix.
2. **Kiểm tra gói phát hành tự động.** Lỗi thiếu symlink ở gói v1.0.1 lần đầu chỉ bị smoke test bắt. Đề xuất một job CI: dựng gói, giải nén vào thư mục trống, `npm ci`, `npm start`, gọi `/api/health`. Ghi quy ước đóng gói `zip -y` vào hướng dẫn phát hành.
3. **Không để lỗi nạp logging làm sập server.** Khi thiếu module `winston`, `register()` làm cả server không chạy. Nên bọc phần nạp `log-node` trong `try/catch`: ghi lỗi ra console và tiếp tục chạy với log console.
4. **Giám sát:** gọi `GET /api/health` định kỳ (mỗi phút) và cảnh báo khi khác 200; thêm bước "health = 200 với `config: ok`" vào hướng dẫn triển khai trước khi mở cho người dùng.
5. **Cấu hình:** thêm vào `docs/release/huong-dan-trien-khai.md` bảng biến bắt buộc và cách kiểm tra (đã có trong log `config.ok`/`config.invalid`).

## Tệp bằng chứng

| Thư mục | Nội dung |
|---|---|
| `evidence/a-v1.0.0/k1/` | Timeline K1a/K1b/K1c, console v1.0.0, log mô phỏng người dùng, ảnh 3 trường hợp, log sao lưu |
| `evidence/a-v1.0.0/k2/` | Timeline K2, log người dùng, console web (rỗng), trích log PostgREST/Auth, so sánh số bản ghi, ảnh |
| `evidence/b-red-green/` | Vitest RED/GREEN local, trích log CI hai run |
| `evidence/c-v1.0.1-phat-hanh/` | Log build, lần cài lỗi (`lan1-goi-loi/`), lần cài đúng, smoke test 8 bước, kiểm tra QR, release notes |
| `evidence/d-v1.0.1-lap-lai/` | Timeline lặp lại K1a/K1b/K1c trên v1.0.1, console, log người dùng, ảnh |

Ảnh chụp bằng Playwright (Chromium headless, image `mcr.microsoft.com/playwright:v1.49.1-jammy`) vì cần gõ MSSV/PIN mà không gửi phím được vào Cốc Cốc. Dữ liệu là tài khoản demo giả; đường dẫn máy đã thay bằng `~` hoặc `<scratch>`.
