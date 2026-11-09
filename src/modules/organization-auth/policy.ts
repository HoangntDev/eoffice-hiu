// Chính sách đăng nhập tổ chức: giới hạn thử (R5), lỗi chung (R5), cookie phiên tạm 5 phút (R2).
export type OrgLoginAttemptPolicy = {
  action: "org_login";
  maxFailures: number;
  windowMinutes: number;
  scope: ("organization" | "ip")[];
};

export type OrganizationLoginFailureReason =
  | "wrong_organization_pin"
  | "organization_locked"
  | "unknown_organization"
  | "wrong_student_code"
  | "wrong_personal_pin"
  | "personal_account_inactive"
  | "not_a_member"
  | "pending_login_expired";

export type OrganizationLoginFailure = { status: number; code: string; message: string };

export type PendingLoginCookieOptions = {
  httpOnly: boolean;
  sameSite: "strict" | "lax";
  path: string;
  maxAge: number;
};

export function orgLoginAttemptPolicy(): OrgLoginAttemptPolicy {
  return { action: "org_login", maxFailures: 5, windowMinutes: 15, scope: ["organization", "ip"] };
}

export function organizationLoginFailure(reason: OrganizationLoginFailureReason): OrganizationLoginFailure {
  void reason;
  return {
    status: 401,
    code: "INVALID_CREDENTIALS",
    message: "Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra và thử lại.",
  };
}

export function pendingLoginCookieOptions(): PendingLoginCookieOptions {
  return { httpOnly: true, sameSite: "strict", path: "/", maxAge: 300 };
}
