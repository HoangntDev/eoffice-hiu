// Chính sách đăng nhập tổ chức: giới hạn thử (R5), lỗi chung (R5), cookie phiên tạm 5 phút (R2).
import { NotImplementedError } from "./errors";

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
  throw new NotImplementedError("orgLoginAttemptPolicy");
}

export function organizationLoginFailure(reason: OrganizationLoginFailureReason): OrganizationLoginFailure {
  void reason;
  throw new NotImplementedError("organizationLoginFailure");
}

export function pendingLoginCookieOptions(): PendingLoginCookieOptions {
  throw new NotImplementedError("pendingLoginCookieOptions");
}
