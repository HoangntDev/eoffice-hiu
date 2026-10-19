import { describe, expect, it } from "vitest";
import { registrationBlockReason, type EligibilityInput } from "@/modules/program-registrations/eligibility";

const now = new Date("2026-10-20T00:00:00Z");
const open: EligibilityInput = {
  settingsStatus: "open", closesAt: null, programEndsAt: null, capacity: 10, accepted: 3,
  requiresApproval: false, audienceOk: true, now,
};

describe("registrationBlockReason", () => {
  it("cho đăng ký khi mở, đúng đối tượng, còn chỗ", () => {
    expect(registrationBlockReason(open)).toBeNull();
  });
  it("chưa cấu hình, nháp, đã đóng", () => {
    expect(registrationBlockReason({ ...open, settingsStatus: null })).toBe("not_configured");
    expect(registrationBlockReason({ ...open, settingsStatus: "draft" })).toBe("not_open");
    expect(registrationBlockReason({ ...open, settingsStatus: "closed" })).toBe("closed");
  });
  it("quá hạn đăng ký hoặc chương trình đã kết thúc thì coi là đã đóng", () => {
    expect(registrationBlockReason({ ...open, closesAt: "2026-10-19T23:59:59Z" })).toBe("closed");
    expect(registrationBlockReason({ ...open, programEndsAt: "2026-10-19T10:00:00Z" })).toBe("closed");
  });
  it("sai đối tượng được báo trước hết chỗ", () => {
    expect(registrationBlockReason({ ...open, audienceOk: false, accepted: 10 })).toBe("audience");
  });
  it("hết chỗ chỉ khi nhận theo thứ tự", () => {
    expect(registrationBlockReason({ ...open, accepted: 10 })).toBe("full");
    expect(registrationBlockReason({ ...open, accepted: 10, requiresApproval: true })).toBeNull();
    expect(registrationBlockReason({ ...open, capacity: null, accepted: 999 })).toBeNull();
  });
});
