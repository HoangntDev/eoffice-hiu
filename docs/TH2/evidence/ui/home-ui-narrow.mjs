// Thanh đầu trang của khách ở 360/320 px: không cuộn ngang, nút không tràn. Chạy giống home-ui.mjs.
import { chromium } from "playwright";
const b = await chromium.launch();
for (const w of [360, 320]) {
  const p = await b.newPage({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2 });
  await p.goto("http://host.docker.internal:3200/", { waitUntil: "load" });
  const r = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, login: document.querySelector(".header-login").getBoundingClientRect().right, reg: document.querySelector(".header-link").getBoundingClientRect().width }));
  console.log(`${w}px: scrollWidth=${r.scroll}, mép phải nút Đăng nhập=${Math.round(r.login)}, rộng "Tạo tài khoản"=${Math.round(r.reg)}`);
  await p.screenshot({ path: `/out/home-sau-header-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
}
await b.close();
