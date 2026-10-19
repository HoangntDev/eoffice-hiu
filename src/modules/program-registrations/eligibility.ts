// Gợi ý cho sinh viên vì sao chưa đăng ký được. Chỉ để hiển thị:
// RPC register_for_program vẫn là nơi quyết định (cùng thứ tự kiểm tra như dưới đây).

export type BlockReason = "not_configured" | "not_open" | "closed" | "full" | "audience";

export const blockReasonLabels: Record<BlockReason, string> = {
  not_configured: "Không nhận đăng ký qua hệ thống",
  not_open: "Chưa mở đăng ký",
  closed: "Đã đóng đăng ký",
  full: "Đã hết chỗ",
  audience: "Không thuộc đối tượng",
};

export type EligibilityInput = {
  settingsStatus: "draft" | "open" | "closed" | null;
  closesAt: string | null;
  programEndsAt: string | null;
  capacity: number | null;
  accepted: number;
  requiresApproval: boolean;
  audienceOk: boolean | null;
  now?: Date;
};

export function registrationBlockReason(input: EligibilityInput): BlockReason | null {
  const now = input.now ?? new Date();
  if (input.settingsStatus === null) return "not_configured";
  if (input.settingsStatus === "draft") return "not_open";
  if (input.settingsStatus === "closed") return "closed";
  if ((input.closesAt && new Date(input.closesAt) <= now) || (input.programEndsAt && new Date(input.programEndsAt) <= now)) {
    return "closed";
  }
  if (input.audienceOk === false) return "audience";
  // Có xét duyệt thì vẫn nhận hồ sơ chờ; chỉ chặn khi nhận theo thứ tự và đã đủ chỗ.
  if (!input.requiresApproval && input.capacity !== null && input.accepted >= input.capacity) return "full";
  return null;
}
