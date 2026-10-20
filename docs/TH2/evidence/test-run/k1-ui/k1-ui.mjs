// K1 qua giao diện: khách mở link QR → đăng nhập 2 bước → quay lại trang điểm danh.
// Chạy trong image mcr.microsoft.com/playwright:v1.49.1-jammy (cài playwright@1.49.1), web demo ở cổng 3200:
//   docker run --rm --add-host=host.docker.internal:host-gateway -v "$PWD:/out" -w /out <image> \
//     sh -c 'npm i playwright@1.49.1 && node k1-ui.mjs <sessionId đang mở>'
import { chromium, request } from "playwright";
const BASE = "http://host.docker.internal:3200";
const SESSION = process.argv[2];
const api = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE } });
await api.post("/api/auth/login", { data: { studentCode: "2201110201", pin: "123456" } });
const qr = await (await api.post(`/api/attendance/sessions/${SESSION}/qr`)).json();
const qrPath = new URL(qr.url).pathname + new URL(qr.url).search;
const redact = (u) => u.replace(/(\.[0-9]{10,16}\.)[0-9a-f]{32}/g, "$1<chữ ký>");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const t0 = Date.now();
await page.goto(BASE + qrPath, { waitUntil: "load" });
console.log(`1. Mở link QR khi chưa đăng nhập: ${redact(qrPath)}`);
console.log(`2. Trang hiện tại: ${redact(page.url().replace(BASE, ""))}`);
await page.screenshot({ path: "/out/k1-1-trang-dang-nhap.png" });
await page.fill('input[name="studentCode"], input.mssv-input', "2211110102");
await page.click("button.primary");
await page.waitForTimeout(500);
await page.keyboard.type("123456");
await page.waitForURL(/\/attend\//, { timeout: 15000 });
await page.waitForTimeout(2500);
console.log(`3. Sau khi đăng nhập (MSSV 2211110102 + PIN): ${redact(page.url().replace(BASE, ""))} — sau ${((Date.now() - t0) / 1000).toFixed(1)} giây`);
const notice = (await page.locator("main").innerText()).split("\n").filter((l) => /điểm danh|QR|lượt/i.test(l)).slice(0, 4).join(" | ");
console.log(`4. Nội dung trang: ${notice}`);
await page.screenshot({ path: "/out/k1-2-diem-danh-sau-dang-nhap.png" });
await browser.close();
