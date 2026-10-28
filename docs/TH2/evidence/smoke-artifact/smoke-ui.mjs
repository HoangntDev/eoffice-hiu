// Smoke test bước 5–8 (docs/testing/smoke-test.md) trên gói v1.0.0, web ở cổng 3300, stack eoffice-v100.
// Chạy trong image mcr.microsoft.com/playwright:v1.49.1-jammy (cài playwright@1.49.1):
//   docker run --rm --add-host=host.docker.internal:host-gateway -v "$PWD:/out" -w /out <image> \
//     sh -c 'npm i playwright@1.49.1 && node smoke-ui.mjs'
import { chromium } from "playwright";
const BASE = "http://host.docker.internal:3300";
const [MSSV, NAME] = [process.argv[2] ?? "2241110104", process.argv[3] ?? "Đặng Hoàng Phúc"]; // tài khoản demo (dữ liệu giả), PIN 123456
const PROGRAM = "Ngày hội Hiến máu tình nguyện";
const ok = (step, pass, detail) => console.log(`[Bước ${step}] ${pass ? "PASS" : "FAIL"} – ${detail}`);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage();

// 5. Đăng nhập
await page.goto(BASE + "/login", { waitUntil: "load" });
await page.fill("input.mssv-input", MSSV);
await page.click("button.primary");
await page.waitForTimeout(500);
await page.keyboard.type("123456");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
const who = (await page.locator(".account-menu-trigger").innerText()).replace(/\s+/g, " ").trim();
ok(5, who.includes(NAME) && who.includes(MSSV), `URL ${new URL(page.url()).pathname}; thanh trên: "${who}"`);

// 6. Màn hình chính
await page.goto(BASE + "/", { waitUntil: "load" });
const myWork = await page.getByText("Việc của tôi").count();
await page.goto(BASE + "/programs", { waitUntil: "load" });
const headers = (await page.locator("main th").allInnerTexts()).map((h) => h.trim());
const row = page.locator("main tr", { hasText: PROGRAM });
const before = (await row.innerText()).replace(/\s+/g, " ");
ok(6, myWork > 0 && headers.some((h) => /đăng ký của tôi/i.test(h)),
  `"Việc của tôi": ${myWork > 0}; cột: ${headers.filter(Boolean).join(" | ")}; dòng trước: "${before}"`);

// 7. Giao dịch chính (UC-C): đăng ký chương trình đang mở
await row.getByRole("link", { name: "Xem" }).click();
await page.waitForLoadState("load");
await page.getByRole("button", { name: "Gửi đăng ký" }).click();
const msg = page.getByText(/đăng ký thành công|đã đăng ký|chờ duyệt|đã ghi nhận/i).first();
await msg.waitFor({ timeout: 15000 });
const msgText = (await msg.innerText()).replace(/\s+/g, " ").trim();
await page.goto(BASE + "/programs", { waitUntil: "load" });
const after = (await page.locator("main tr", { hasText: PROGRAM }).innerText()).replace(/\s+/g, " ");
await page.goto(BASE + "/", { waitUntil: "load" });
const homeHas = await page.locator("main", { hasText: "Hiến máu" }).count();
ok(7, !/Đang mở đăng ký/.test(after) && homeHas > 0,
  `thông báo: "${msgText}"; dòng sau: "${after}"; "Việc của tôi" có chương trình: ${homeHas > 0}`);

// 8. Đăng xuất
await page.click(".account-menu-trigger");
await page.getByRole("button", { name: "Đăng xuất" }).or(page.getByRole("menuitem", { name: "Đăng xuất" })).first().click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
await page.waitForLoadState("networkidle"); // chờ điều hướng sau đăng xuất xong rồi mới mở trang khác
const guest = (await page.getByRole("link", { name: "Đăng nhập" }).count()) > 0;
await page.goto(BASE + "/programs", { waitUntil: "load" });
const url = new URL(page.url());
ok(8, guest && url.pathname === "/login", `sau đăng xuất về "/", có nút Đăng nhập: ${guest}; mở /programs → ${url.pathname}${url.search}`);

await browser.close();
