// Ảnh trang chủ (khách + đã đăng nhập) ở desktop và mobile, dùng cho issue lặp nút Đăng nhập/Tạo tài khoản.
// Chạy trong image mcr.microsoft.com/playwright:v1.49.1-jammy (cài playwright@1.49.1), web demo ở cổng 3200:
//   docker run --rm --add-host=host.docker.internal:host-gateway -v "$PWD:/out" -w /out <image> \
//     sh -c 'npm i playwright@1.49.1 && node home-ui.mjs <truoc|sau>'
import { chromium } from "playwright";
const BASE = "http://host.docker.internal:3200";
const TAG = process.argv[2];
const sizes = { desktop: { width: 1366, height: 860 }, mobile: { width: 390, height: 844 } };
const browser = await chromium.launch();
for (const [name, viewport] of Object.entries(sizes)) {
  const guest = await browser.newPage({ viewport, deviceScaleFactor: name === "mobile" ? 2 : 1 });
  await guest.goto(BASE + "/", { waitUntil: "load" });
  const links = await guest.locator("a").evaluateAll((as) =>
    as.filter((a) => a.offsetParent !== null).map((a) => `${a.textContent.trim()} → ${a.getAttribute("href")}`));
  console.log(`[${TAG}] ${name} khách, link đang hiện: ${links.filter((l) => /Đăng nhập|Tạo tài khoản|biểu mẫu/i.test(l)).join(" | ")}`);
  const steps = await guest.locator(".guide-list li").allInnerTexts();
  console.log(`[${TAG}] ${name} khách, các bước: ${steps.map((s) => s.replace(/\s+/g, " ")).join(" | ")}`);
  console.log(`[${TAG}] ${name} khách, cuộn ngang: ${await guest.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`);
  await guest.screenshot({ path: `/out/home-${TAG}-khach-${name}.png`, fullPage: true });
  await guest.close();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === "mobile" ? 2 : 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "load" });
  await page.fill("input.mssv-input", "2211110101");
  await page.click("button.primary");
  await page.waitForTimeout(500);
  await page.keyboard.type("123456");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  await page.goto(BASE + "/", { waitUntil: "load" });
  console.log(`[${TAG}] ${name} đã đăng nhập (2211110101): ${(await page.locator("h1").first().innerText())}; có "Việc của tôi": ${await page.getByText("Việc của tôi").count() > 0}`);
  await page.screenshot({ path: `/out/home-${TAG}-da-dang-nhap-${name}.png` });
  await ctx.close();
}
await browser.close();
