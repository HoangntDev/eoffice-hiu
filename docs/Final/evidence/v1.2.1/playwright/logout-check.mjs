// Kiểm tay #84/#85 trên bản build: đăng xuất sinh viên, đăng xuất tổ chức, "Đổi cán bộ" rồi mở lại tab cũ.
// Chạy trong mcr.microsoft.com/playwright:v1.49.1-jammy; BASE, LABEL qua biến môi trường. Dữ liệu demo giả, PIN 123456.
import net from "node:net";
import { chromium } from "playwright";

// Trình duyệt phải mở http://127.0.0.1:<cổng> (ngữ cảnh an toàn, cookie Secure được nhận, cùng origin với
// NEXT_PUBLIC_APP_URL). Trong container, chuyển tiếp 127.0.0.1:<cổng> sang app trên máy chủ.
const PORT = Number(process.env.PORT);
const forwarder = net.createServer((client) => {
  const upstream = net.connect(PORT, "host.docker.internal");
  client.pipe(upstream).pipe(client);
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
});
await new Promise((resolve) => forwarder.listen(PORT, "127.0.0.1", resolve));
const BASE = `http://127.0.0.1:${PORT}`;
const LABEL = process.env.LABEL;
const OUT = "/out";
const UNIT = "Đoàn Khoa Khoa Công Nghệ - Kỹ Thuật";
const out = (...a) => console.log(`[${LABEL}]`, ...a);
const browser = await chromium.launch();

function watch500(page, bucket) {
  page.on("response", (r) => { if (r.status() >= 500) bucket.push(`${r.status()} ${new URL(r.url()).pathname}`); });
}

async function studentLogin(page, mssv) {
  await page.goto(BASE + "/login", { waitUntil: "load" });
  await page.fill("input.mssv-input", mssv);
  await page.click("button.primary");
  await page.waitForTimeout(500);
  await page.keyboard.type("123456");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function orgLogin(page, officer) {
  await page.goto(BASE + "/admin/login", { waitUntil: "load" });
  await page.selectOption('select[name="organizationId"]', { label: UNIT });
  await page.getByLabel("Vùng nhập PIN tổ chức").click();
  await page.keyboard.type("135790");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.waitForURL((u) => u.pathname === "/admin/login/officer", { timeout: 20000 });
  await page.fill('input[name="studentCode"]', officer);
  await page.getByLabel("Vùng nhập PIN cá nhân").click();
  await page.keyboard.type("123456");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin") && !u.pathname.startsWith("/admin/login"), { timeout: 20000 });
}

async function logout(page) {
  await page.click(".account-menu-trigger");
  const t0 = Date.now();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  try {
    await page.waitForURL((u) => u.pathname === "/login" || u.pathname === "/admin/login", { timeout: 20000 });
    return { done: true, ms: Date.now() - t0, path: new URL(page.url()).pathname };
  } catch {
    const stuck = await page.getByRole("button", { name: "Đang đăng xuất…" }).count();
    return { done: false, ms: Date.now() - t0, stuck: stuck > 0, path: new URL(page.url()).pathname };
  }
}

const ctxOpts = { viewport: { width: 1366, height: 860 } };
process.on("unhandledRejection", (e) => { out("LỖI KỊCH BẢN:", e?.message?.split("\n")[0]); process.exit(1); });

// 1. Sinh viên đăng xuất
{
  const errors = [];
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage(); watch500(page, errors);
  await studentLogin(page, "2211110102");
  const r = await logout(page);
  await page.screenshot({ path: `${OUT}/${LABEL}-1-sinh-vien-dang-xuat.png` });
  await page.goto(BASE + "/programs", { waitUntil: "load" });
  const after = new URL(page.url());
  out(`1 SV đăng xuất: ${r.done ? "chuyển trang" : "KẸT"} sau ${r.ms} ms → ${r.path}${r.stuck ? " (nút còn 'Đang đăng xuất…')" : ""}; mở /programs → ${after.pathname}${after.search}; 5xx: ${errors.join(", ") || "không"}`);
  await ctx.close();
}

// 2. Tổ chức đăng xuất
{
  const errors = [];
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage(); watch500(page, errors);
  await orgLogin(page, "2201110201");
  const r = await logout(page);
  await page.screenshot({ path: `${OUT}/${LABEL}-2-to-chuc-dang-xuat.png` });
  await page.goto(BASE + "/admin", { waitUntil: "load" });
  const after = new URL(page.url());
  out(`2 Tổ chức đăng xuất: ${r.done ? "chuyển trang" : "KẸT"} sau ${r.ms} ms → ${r.path}${r.stuck ? " (nút còn 'Đang đăng xuất…')" : ""}; mở /admin → ${after.pathname}; 5xx: ${errors.join(", ") || "không"}`);
  await ctx.close();
}

// 3. "Đổi cán bộ" rồi mở lại tab cũ (cookie của phiên đã bị thu hồi)
{
  const errors = [];
  const ctx = await browser.newContext(ctxOpts);
  const page1 = await ctx.newPage(); watch500(page1, errors);
  await orgLogin(page1, "2201110201");
  const oldState = await ctx.storageState();
  const page2 = await ctx.newPage(); watch500(page2, errors);
  await page2.goto(BASE + "/admin", { waitUntil: "load" });
  await page1.getByRole("button", { name: "Đổi cán bộ" }).click();
  await page1.waitForURL((u) => u.pathname === "/admin/login/officer", { timeout: 20000 });
  const reload = await page2.reload({ waitUntil: "load" });
  await page2.screenshot({ path: `${OUT}/${LABEL}-3-tab-cu-sau-doi-can-bo.png` });
  out(`3a Tab cũ sau "Đổi cán bộ": HTTP ${reload?.status()} → ${new URL(page2.url()).pathname}`);
  await ctx.close();

  // Trình duyệt khác còn giữ cookie của phiên đã bị thu hồi.
  const stale = await browser.newContext({ ...ctxOpts, storageState: oldState });
  const page = await stale.newPage(); watch500(page, errors);
  const results = [];
  for (const path of ["/", "/login", "/admin", "/programs"]) {
    const res = await page.goto(BASE + path, { waitUntil: "load" });
    results.push(`${path} → HTTP ${res?.status()} ${new URL(page.url()).pathname}`);
  }
  await page.screenshot({ path: `${OUT}/${LABEL}-3-cookie-phien-thu-hoi.png` });
  const left = (await stale.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value).length;
  out(`3b Cookie phiên đã thu hồi: ${results.join("; ")}; cookie phiên còn lại: ${left}; 5xx: ${errors.join(", ") || "không"}`);
  await stale.close();
}

await browser.close();
forwarder.close();
