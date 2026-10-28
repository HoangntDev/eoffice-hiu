// Ảnh minh chứng smoke test: bản cài từ gói v1.0.0 (web cổng 3300, stack eoffice-v100), trang chương trình đã đăng ký.
// Chạy trong image mcr.microsoft.com/playwright:v1.49.1-jammy (cài playwright@1.49.1):
//   docker run --rm --add-host=host.docker.internal:host-gateway -v "$PWD:/out" -w /out <image> \
//     sh -c 'npm i --prefix /tmp/pw playwright@1.49.1 && cp smoke-screenshot.mjs /tmp/pw/s.mjs && cd /tmp/pw && node s.mjs'
// Trong container, localhost:3300 của máy là host.docker.internal:3300.
import { chromium } from "playwright";
const BASE = "http://host.docker.internal:3300";
const PROGRAM = "Ngày hội Hiến máu tình nguyện";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
await page.goto(BASE + "/login", { waitUntil: "load" });
await page.fill("input.mssv-input", "2241110104"); // tài khoản demo (dữ liệu giả), PIN 123456
await page.click("button.primary");
await page.waitForTimeout(500);
await page.keyboard.type("123456");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
await page.goto(BASE + "/programs", { waitUntil: "load" });
const row = page.locator("main tr", { hasText: PROGRAM });
console.log(`Danh sách: ${(await row.innerText()).replace(/\s+/g, " ")}`);
await row.getByRole("link", { name: "Xem" }).click();
await page.waitForLoadState("networkidle");
console.log(`URL: ${page.url().replace(BASE, "http://localhost:3300")}`);
console.log(`Trang: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400)}`);
await page.screenshot({ path: "/out/smoke-dang-ky-thanh-cong.png", fullPage: true });
await browser.close();
