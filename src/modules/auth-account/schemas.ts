import { z } from "zod";

export const studentCodeSchema = z.string().regex(/^\d{10}$/, "MSSV hiện phải có đúng 10 chữ số.");
export const gmailSchema = z.string().trim().toLowerCase().email().regex(/@gmail\.com$/i, "Phải dùng địa chỉ Gmail.");
export const pinSchema = z.string().regex(/^\d{6}$/, "PIN phải có đúng 6 chữ số.");

export const registerSchema = z.object({
  studentCode: studentCodeSchema,
  gmail: gmailSchema,
}).strict();

export const loginSchema = z.object({
  studentCode: studentCodeSchema,
  pin: pinSchema,
}).strict();

export const recoverSchema = z.object({ studentCode: studentCodeSchema }).strict();

export const changeEmailSchema = z.object({ gmail: gmailSchema }).strict();

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
