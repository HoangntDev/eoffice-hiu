import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/tmp/th4-playwright/node_modules/playwright/index.mjs";

const baseURL = process.env.TH4_BASE_URL ?? "http://localhost:3200";
const personalPin = process.env.TH4_PERSONAL_PIN;
if (!personalPin) throw new Error("Thiếu TH4_PERSONAL_PIN cho stack kiểm thử cục bộ.");

const outputDir = new URL("./smoke/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const results = [];
const pass = (step, detail) => results.push({ step, result: "PASS", detail });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN" });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/login`);
  await page.locator("input[name=studentCode]").fill("2241110104");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("PIN 6 chữ số").fill(personalPin);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.locator(".account-menu-trigger").click();
  const accountPanel = page.locator(".account-menu-panel");
  assert((await accountPanel.textContent())?.includes("Đặng Hoàng Phúc"), "Thanh tài khoản thiếu họ tên");
  assert((await accountPanel.textContent())?.includes("2241110104"), "Thanh tài khoản thiếu MSSV");
  pass(5, "Đăng nhập bằng tài khoản demo; thanh tài khoản hiện họ tên và MSSV.");

  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Việc của tôi" }).waitFor();
  await page.goto(`${baseURL}/programs`);
  assert(new URL(page.url()).pathname === "/programs", `Không mở được /programs: ${page.url()}`);
  await page.locator("th").filter({ hasText: "Đăng ký của tôi" }).waitFor();
  pass(6, "Trang chủ có khối Việc của tôi; danh sách chương trình có cột Đăng ký của tôi.");

  const programRow = page.locator("tr").filter({ hasText: "Ngày hội Hiến máu tình nguyện" });
  await programRow.getByRole("link", { name: "Xem" }).click();
  await page.getByRole("heading", { name: "Đăng ký tham gia", exact: true }).last().waitFor();
  const responsePromise = page.waitForResponse((response) =>
    /\/api\/event-programs\/[0-9a-f-]{36}\/registrations$/.test(new URL(response.url()).pathname)
      && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gửi đăng ký" }).click();
  const response = await responsePromise;
  assert(response.status() === 201, `Giao dịch đăng ký trả HTTP ${response.status()}`);
  await page.getByText("Đăng ký thành công. Bạn đã được xác nhận tham gia.").waitFor();
  await page.reload();
  await page.getByText("Đã xác nhận").last().waitFor();
  await page.screenshot({ path: new URL("01-registration-success.png", outputDir).pathname, fullPage: true });
  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Việc của tôi" }).waitFor();
  assert((await page.locator("main").textContent())?.includes("Ngày hội Hiến máu"), "Việc của tôi chưa hiện giao dịch vừa tạo");
  pass(7, "Đăng ký chương trình thành công; trạng thái hiện ở chi tiết và Việc của tôi.");

  await page.locator(".account-menu-trigger").click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL("**/login");
  await page.goto(`${baseURL}/programs`);
  await page.waitForURL("**/login?next=%2Fprograms");
  await page.screenshot({ path: new URL("02-logout-protected-route.png", outputDir).pathname, fullPage: true });
  pass(8, "Đăng xuất về trang đăng nhập; /programs tiếp tục chuyển về /login.");
} finally {
  await context.close();
  await browser.close();
}

await writeFile(new URL("results.json", outputDir), `${JSON.stringify({ baseURL, results }, null, 2)}\n`);
console.log(`PLAYWRIGHT_SMOKE_OK steps=${results.length}`);
