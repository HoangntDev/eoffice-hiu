import { z } from "zod";

export const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().trim().regex(/^\+?\d{9,15}$/, "Số điện thoại chưa hợp lệ."),
  classId: z.uuid(),
}).strict();
