import { z } from "zod";

export const studentCodeSchema = z.string().regex(/^\d{10}$/, "MSSV hiện phải có đúng 10 chữ số.");
export const studentEmailSchema = z.string().trim().toLowerCase().email().regex(/@student\.hiu\.vn$/i, "Phải dùng email sinh viên HIU (@student.hiu.vn).");
/** @deprecated DB RPC params still named "gmail" — keep alias to avoid renaming migrations */
export const gmailSchema = studentEmailSchema;
export const pinSchema = z.string().regex(/^\d{6}$/, "PIN phải có đúng 6 chữ số.");

export const registerSchema = z.object({
  studentCode: studentCodeSchema,
  gmail: studentEmailSchema,
}).strict().superRefine((val, ctx) => {
  // numeric suffix of student email must match mssv[0:3] + mssv[6:10]
  const expected = val.studentCode.slice(0, 3) + val.studentCode.slice(6);
  const localPart = val.gmail.split("@")[0] ?? "";
  if (!localPart.endsWith(expected)) {
    ctx.addIssue({
      code: "custom",
      path: ["gmail"],
      message: `Email sinh viên không khớp với MSSV (phải kết thúc bằng ${expected}@student.hiu.vn).`,
    });
  }
});

export const loginSchema = z.object({
  studentCode: studentCodeSchema,
  pin: pinSchema,
  // Đường dẫn quay lại; API chỉ dùng sau khi safeNextPath kiểm tra là nội bộ.
  next: z.string().max(2048).optional(),
}).strict();

// SPIKE CR-01: đăng nhập tổ chức hai bước. Bước 1: đơn vị + PIN tổ chức. Bước 2: MSSV + PIN cán bộ.
export const organizationLoginSchema = z.object({
  organizationId: z.string().uuid(),
  organizationPin: pinSchema,
}).strict();

export const officerLoginSchema = z.object({
  studentCode: studentCodeSchema,
  pin: pinSchema,
}).strict();

export const recoverSchema = z.object({ studentCode: studentCodeSchema }).strict();

export const changeEmailSchema = z.object({ gmail: studentEmailSchema }).strict();

export const createPinSchema = z.object({
  pin: pinSchema,
  confirmPin: pinSchema,
}).strict().refine((value) => value.pin === value.confirmPin, {
  message: "Hai lần nhập PIN không khớp.",
  path: ["confirmPin"],
});

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
  confirmPin: pinSchema,
}).strict()
  .refine((value) => value.newPin === value.confirmPin, {
    message: "Hai lần nhập PIN mới không khớp.",
    path: ["confirmPin"],
  })
  .refine((value) => value.currentPin !== value.newPin, {
    message: "PIN mới phải khác PIN hiện tại.",
    path: ["newPin"],
  });

export const changeStudentCodeSchema = z.object({
  userId: z.uuid(),
  newStudentCode: studentCodeSchema,
  reason: z.string().trim().min(5).max(500),
  roleGrantId: z.uuid().nullable().optional(),
}).strict();
