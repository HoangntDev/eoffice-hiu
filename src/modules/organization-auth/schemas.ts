// Đăng nhập tổ chức hai bước (R2). Bước 1: đơn vị + PIN tổ chức. Bước 2: MSSV + PIN cá nhân của cán bộ.
import { NotImplementedError } from "./errors";

export type OrganizationLoginStep1 = { organizationId: string; organizationPin: string };
export type OfficerLoginStep2 = { studentCode: string; pin: string };

export function parseOrganizationLoginStep1(input: unknown): OrganizationLoginStep1 {
  void input;
  throw new NotImplementedError("parseOrganizationLoginStep1");
}

export function parseOfficerLoginStep2(input: unknown): OfficerLoginStep2 {
  void input;
  throw new NotImplementedError("parseOfficerLoginStep2");
}
