// Smoke bước 5–8 (docs/testing/smoke-test.md) trên gói tải từ Release. Tài khoản demo giả, PIN 123456.
// Trình duyệt mở http://127.0.0.1:<PORT> qua bộ chuyển tiếp TCP trong container (cùng origin với NEXT_PUBLIC_APP_URL).
import net from "node:net";
import { chromium } from "playwright";
const PORT = Number(process.env.PORT);
const LABEL = process.env.LABEL;
const forwarder = net.createServer((c) => { const u = net.connect(PORT, "host.docker.internal"); c.pipe(u).pipe(c); c.on("error", () => u.destroy()); u.on("error", () => c.destroy()); });
await new Promise((r) => forwarder.listen(PORT, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${PORT}`;
const [MSSV, NAME] = ["2201110203", "Phạm Quốc Bảo"];
const PROGRAM = "Ngày hội Hiến máu";
const ok = (step, pass, detail) => console.log(`[Bước ${step}] ${pass ? "PASS" : "FAIL"} – ${detail}`);
const errors = [];
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });

// 5. Đăng nhập
await page.goto(BASE + "/login", { waitUntil: "load" });
await page.fill("input.mssv-input", MSSV);
await page.click("button.primary");
await page.waitForTimeout(500);
await page.keyboard.type("123456");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
const who = (await page.locator(".account-menu-trigger").innerText()).replace(/\s+/g, " ").trim();
ok(5, who.includes(NAME) && who.includes(MSSV), `URL ${new URL(page.url()).pathname}; thanh trên: "${who}"`);
await page.screenshot({ path: `/out/${LABEL}-5-dang-nhap.png` });

// 6. Màn hình chính
await page.goto(BASE + "/", { waitUntil: "load" });
const myWork = await page.getByText("Việc của tôi").count();
await page.goto(BASE + "/programs", { waitUntil: "load" });
const headers = (await page.locator("main th").allInnerTexts()).map((h) => h.trim());
const row = page.locator("main tr", { hasText: PROGRAM });
const before = (await row.innerText()).replace(/\s+/g, " ");
ok(6, myWork > 0 && headers.some((h) => /đăng ký của tôi/i.test(h)),
  `"Việc của tôi": ${myWork > 0}; cột: ${headers.filter(Boolean).join(" | ")}; dòng trước: "${before}"`);
await page.screenshot({ path: `/out/${LABEL}-6-chuong-trinh.png` });

// 7. Giao dịch chính (UC-C): đăng ký chương trình đang mở
await row.getByRole("link", { name: "Xem" }).click();
await page.waitForLoadState("load");
await page.getByRole("button", { name: "Gửi đăng ký" }).click();
const msg = page.getByText(/đăng ký thành công|đã đăng ký|chờ duyệt|đã ghi nhận/i).first();
await msg.waitFor({ timeout: 15000 });
const msgText = (await msg.innerText()).replace(/\s+/g, " ").trim();
await page.screenshot({ path: `/out/${LABEL}-7-dang-ky.png` });
await page.goto(BASE + "/programs", { waitUntil: "load" });
const after = (await page.locator("main tr", { hasText: PROGRAM }).innerText()).replace(/\s+/g, " ");
await page.goto(BASE + "/", { waitUntil: "load" });
const homeHas = await page.locator("main", { hasText: "Hiến máu" }).count();
ok(7, !/Đang mở đăng ký/.test(after) && homeHas > 0,
  `thông báo: "${msgText}"; dòng sau: "${after}"; "Việc của tôi" có chương trình: ${homeHas > 0}`);

// 8. Đăng xuất (từ v1.1.0 đăng xuất về /login thay vì trang chủ khách)
await page.click(".account-menu-trigger");
const t0 = Date.now();
await page.getByRole("button", { name: "Đăng xuất" }).click();
let loggedOut = true;
try { await page.waitForURL((u) => u.pathname === "/login", { timeout: 20000 }); } catch { loggedOut = false; }
const ms = Date.now() - t0;
await page.waitForLoadState("networkidle");
const guest = (await page.getByRole("link", { name: "Đăng nhập" }).count()) > 0;
await page.screenshot({ path: `/out/${LABEL}-8-dang-xuat.png` });
await page.goto(BASE + "/programs", { waitUntil: "load" });
const url = new URL(page.url());
ok(8, loggedOut && guest && url.pathname === "/login", `về /login sau ${ms} ms, có nút Đăng nhập: ${guest}; mở /programs → ${url.pathname}${url.search}`);
console.log(`5xx trong toàn bộ smoke: ${errors.join(", ") || "không"}`);
await browser.close();
forwarder.close();
