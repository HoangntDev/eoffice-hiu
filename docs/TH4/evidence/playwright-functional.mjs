import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/tmp/th4-playwright/node_modules/playwright/index.mjs";

const baseURL = process.env.TH4_BASE_URL ?? "http://localhost:3200";
const organizationPin = process.env.TH4_ORG_PIN;
const personalPin = process.env.TH4_PERSONAL_PIN;
const targetOrganizationId = process.env.TH4_TARGET_ORG_ID;
if (!organizationPin || !personalPin || !targetOrganizationId) {
  throw new Error("Thiếu cấu hình kiểm thử cục bộ TH4.");
}

const outputDir = new URL("./functional/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const results = [];
const record = (caseId, result, detail) => results.push({ caseId, result, detail });
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "vi-VN" });
  return { context, page: await context.newPage() };
}

async function organizationLogin(page, unitLabel, officerCode) {
  await page.goto(`${baseURL}/admin/login`);
  await page.locator("select[name=organizationId]").selectOption({ label: unitLabel });
  await page.locator("input[name=organizationPin]").fill(organizationPin);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.waitForURL("**/admin/login/officer");
  await page.locator("input[name=studentCode]").fill(officerCode);
  await page.locator("input[name=pin]").fill(personalPin);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.waitForURL("**/admin");
}

async function personalLogin(page, studentCode) {
  await page.goto(`${baseURL}/login`);
  await page.locator("input[name=studentCode]").fill(studentCode);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("PIN 6 chữ số").fill(personalPin);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

try {
  {
    const { context, page } = await newPage();
    await page.goto(`${baseURL}/login`);
    assert(await page.getByRole("link", { name: "Đăng nhập tài khoản tổ chức" }).getAttribute("href") === "/admin/login", "Thiếu link đăng nhập tổ chức");
    await page.getByRole("link", { name: "Đăng nhập tài khoản tổ chức" }).click();
    await page.locator("select[name=organizationId]").selectOption({ label: "Văn phòng Đoàn – Hội" });
    const wrongPin = organizationPin.replace(/.$/, organizationPin.endsWith("0") ? "1" : "0");
    await page.locator("input[name=organizationPin]").fill(wrongPin);
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    const loginError = page.locator(".notice.error[role=alert]");
    await loginError.waitFor();
    assert((await loginError.textContent())?.includes("Thông tin đăng nhập không hợp lệ"), "Lỗi đăng nhập không dùng thông báo chung");
    await page.screenshot({ path: new URL("01-login-error.png", outputDir).pathname, fullPage: true });
    record("FT-LOGIN-ERROR", "PASS", "Sai PIN tổ chức bị từ chối bằng thông báo chung.");
    await context.close();
  }

  {
    const { context, page } = await newPage();
    await organizationLogin(page, "Đoàn Khoa Khoa Công Nghệ - Kỹ Thuật", "2201110201");
    assert((await page.locator(".admin-context").textContent())?.includes("Lê Minh Quân"), "Thanh ngữ cảnh thiếu cán bộ");
    await page.screenshot({ path: new URL("02-faculty-admin.png", outputDir).pathname, fullPage: true });
    await page.goto(`${baseURL}/admin/programs`);
    assert(await page.getByRole("link", { name: "Lập kế hoạch" }).getAttribute("href") === "/admin/programs/new", "Link lập kế hoạch ra ngoài /admin");
    await page.getByRole("link", { name: "Xem" }).first().click();
    await page.waitForURL(/\/admin\/programs\/[0-9a-f-]{36}$/);
    await page.screenshot({ path: new URL("03-faculty-program.png", outputDir).pathname, fullPage: true });
    await page.goto(`${baseURL}/admin/forms`);
    assert((await page.getByRole("link", { name: "Tạo biểu mẫu" }).getAttribute("href")) === "/admin/forms/new", "Link tạo biểu mẫu ra ngoài /admin");
    await page.goto(`${baseURL}/admin/settings`);
    await page.locator("input[name=currentPin]").fill(organizationPin);
    const temporaryPin = organizationPin.replace(/.$/, organizationPin.endsWith("8") ? "7" : "8");
    await page.locator("input[name=newPin]").fill(temporaryPin);
    await page.getByRole("button", { name: "Đổi PIN tổ chức" }).click();
    await page.getByText("Đã đổi PIN tổ chức.").waitFor();
    await page.locator("input[name=currentPin]").fill(temporaryPin);
    await page.locator("input[name=newPin]").fill(organizationPin);
    await page.getByRole("button", { name: "Đổi PIN tổ chức" }).click();
    await page.getByText("Đã đổi PIN tổ chức.").waitFor();
    await page.goto(`${baseURL}/admin`);
    await page.getByRole("button", { name: "Đổi cán bộ" }).click();
    await page.waitForURL("**/admin/login/officer");
    await page.locator("input[name=studentCode]").fill("2211110102");
    await page.locator("input[name=pin]").fill(personalPin);
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await page.waitForURL("**/admin");
    assert((await page.locator(".admin-context").textContent())?.includes("Võ Thị Bích Ngọc"), "Đổi cán bộ không cập nhật thanh ngữ cảnh");
    await page.screenshot({ path: new URL("04-faculty-switched-officer.png", outputDir).pathname, fullPage: true });
    record("FT-FACULTY", "PASS", "Chương trình, biểu mẫu, đổi PIN và đổi cán bộ chạy trong /admin.");
    await context.close();
  }

  {
    const { context, page } = await newPage();
    await organizationLogin(page, "Văn phòng Đoàn – Hội", "2201110202");
    await page.goto(`${baseURL}/admin/reviews`);
    await page.getByRole("link", { name: "Xem" }).first().click();
    await page.waitForURL(/\/admin\/reviews\/[0-9a-f-]{36}$/);
    await page.getByText("Xét duyệt của Văn phòng").waitFor();
    await page.screenshot({ path: new URL("05-office-review.png", outputDir).pathname, fullPage: true });
    const membershipLoaded = page.waitForResponse((response) => response.url().endsWith("/api/union-membership/review") && response.ok());
    await page.goto(`${baseURL}/admin/membership`);
    await page.getByRole("heading", { name: "Tiếp nhận và công nhận" }).waitFor();
    await membershipLoaded;
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("06-office-membership.png", outputDir).pathname, fullPage: true });
    record("FT-OFFICE", "PASS", "Văn phòng mở được duyệt kế hoạch và hồ sơ Đoàn viên.");
    await context.close();
  }

  {
    const { context, page } = await newPage();
    await organizationLogin(page, "Đoàn Trường", "2201110203");
    await page.goto(`${baseURL}/admin/accounts`);
    const form = page.locator("form");
    async function manage(action, reason) {
      await form.locator("input[name=organizationId]").fill(targetOrganizationId);
      await form.locator("select[name=action]").selectOption(action);
      await form.locator("input[name=pin]").fill(action === "create" || action === "reset_pin" ? organizationPin : "");
      await form.locator("input[name=reason]").fill(reason);
      const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/accounts") && candidate.request().method() === "POST");
      await form.getByRole("button", { name: "Thực hiện" }).click();
      assert((await response).ok(), `Thao tác ${action} thất bại`);
      await page.getByText("Đã cập nhật tài khoản tổ chức.").waitFor();
    }
    await manage("create", "Kiểm thử tạo tài khoản TH4");
    await manage("reset_pin", "Kiểm thử đặt lại PIN TH4");
    await manage("lock", "Kiểm thử khóa tài khoản TH4");
    await manage("unlock", "Kiểm thử mở khóa tài khoản TH4");
    await page.screenshot({ path: new URL("07-school-accounts.png", outputDir).pathname, fullPage: true });
    await page.getByRole("button", { name: "Tắt" }).click();
    await page.waitForURL("**/login");
    await page.goto(`${baseURL}/admin/login`);
    await page.waitForURL("**/login");
    await personalLogin(page, "2201110203");
    const organizationLoaded = page.waitForResponse((response) => response.url().endsWith("/api/organization/catalog") && response.ok());
    await page.goto(`${baseURL}/organization`);
    await page.getByRole("heading", { name: "Danh mục và phân quyền" }).waitFor();
    await organizationLoaded;
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("08-feature-off-personal-fallback.png", outputDir).pathname, fullPage: true });
    record("FT-SCHOOL-AND-FLAG", "PASS", "Tạo/đặt PIN/khóa/mở tài khoản; khi TẮT, /admin bị chặn và tài khoản cá nhân quản lý như v1.0.0.");
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(new URL("results.json", outputDir), `${JSON.stringify({ baseURL, results }, null, 2)}\n`);
console.log(`PLAYWRIGHT_FUNCTIONAL_OK cases=${results.length} screenshots=8`);
