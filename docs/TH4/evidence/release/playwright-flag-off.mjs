import { chromium } from "/tmp/th4-playwright/node_modules/playwright/index.mjs";

const baseURL = process.env.TH4_BASE_URL ?? "http://localhost:3600";
const personalPin = process.env.TH4_PERSONAL_PIN;
if (!personalPin) throw new Error("Thiếu TH4_PERSONAL_PIN cho stack kiểm thử cục bộ.");

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN" });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/admin/login`);
  await page.waitForURL("**/login");

  await page.locator("input[name=studentCode]").fill("2201110203");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("PIN 6 chữ số").fill(personalPin);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  const catalogLoaded = page.waitForResponse(
    (response) => response.url().endsWith("/api/organization/catalog") && response.ok(),
  );
  await page.goto(`${baseURL}/organization`);
  await page.getByRole("heading", { name: "Danh mục và phân quyền" }).waitFor();
  await catalogLoaded;
  await page.getByRole("heading", { name: "Danh mục có ngày hiệu lực" }).waitFor();
  await page.screenshot({
    path: new URL("flag-off-personal-fallback.png", import.meta.url).pathname,
    fullPage: false,
  });

  console.log("FLAG_OFF_RELEASE_OK admin_redirect=/login personal_management=/organization");
} finally {
  await context.close();
  await browser.close();
}
