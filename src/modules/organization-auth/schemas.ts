// Đăng nhập tổ chức hai bước (R2). Bước 1: đơn vị + PIN tổ chức. Bước 2: MSSV + PIN cá nhân của cán bộ.
import { z } from "zod";

export type OrganizationLoginStep1 = { organizationId: string; organizationPin: string };
export type OfficerLoginStep2 = { studentCode: string; pin: string };

const step1Schema = z.object({
  organizationId: z.uuid(),
  organizationPin: z.string().regex(/^\d{6}$/),
}).strict();

const step2Schema = z.object({
  studentCode: z.string().regex(/^\d{10}$/),
  pin: z.string().regex(/^\d{6}$/),
}).strict();

export function parseOrganizationLoginStep1(input: unknown): OrganizationLoginStep1 {
  return step1Schema.parse(input);
}

export function parseOfficerLoginStep2(input: unknown): OfficerLoginStep2 {
  return step2Schema.parse(input);
}
