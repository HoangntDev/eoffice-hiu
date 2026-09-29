import { z } from "zod";

export const studentCodeSchema = z.string().regex(/^\d{10}$/, "MSSV hiện phải có đúng 10 chữ số.");
export const gmailSchema = z.string().trim().toLowerCase().email().regex(/@gmail\.com$/i, "Phải dùng địa chỉ Gmail.");
export const passwordSchema = z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự.").max(72);

export const registerSchema = z.object({
  studentCode: studentCodeSchema,
  gmail: gmailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  studentCode: studentCodeSchema,
  password: passwordSchema,
});

export const recoverSchema = z.object({ studentCode: studentCodeSchema });

export const changeEmailSchema = z.object({ gmail: gmailSchema });

export const changeStudentCodeSchema = z.object({
  userId: z.uuid(),
  newStudentCode: studentCodeSchema,
  reason: z.string().trim().min(5).max(500),
  roleGrantId: z.uuid().nullable().optional(),
});
