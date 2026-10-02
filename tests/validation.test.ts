import { describe, expect, it } from "vitest";
import {
  changePinSchema,
  createPinSchema,
  loginSchema,
  pinSchema,
  registerSchema,
  studentCodeSchema,
} from "@/modules/auth-account/schemas";
import { studentProfileSchema } from "@/modules/student-profile/schemas";

describe("student account validation", () => {
  it("accepts exactly 10 digits and preserves a leading zero", () => {
    expect(studentCodeSchema.parse("0123456789")).toBe("0123456789");
  });
  it("rejects the future 11-digit format today", () => {
    expect(studentCodeSchema.safeParse("01234567890").success).toBe(false);
  });
  it("requires a Gmail address at registration", () => {
    expect(registerSchema.safeParse({ studentCode:"0123456789",gmail:"student@example.com" }).success).toBe(false);
    expect(registerSchema.safeParse({ studentCode:"0123456789",gmail:"student@gmail.com" }).success).toBe(true);
  });
  it("accepts only a six-digit PIN", () => {
    expect(pinSchema.safeParse("012345").success).toBe(true);
    expect(pinSchema.safeParse("12345").success).toBe(false);
    expect(pinSchema.safeParse("1234567").success).toBe(false);
    expect(pinSchema.safeParse("12A456").success).toBe(false);
  });
  it("does not accept Gmail or role as login identity", () => {
    expect(loginSchema.safeParse({ studentCode:"student@gmail.com",pin:"123456",role:"school_admin" }).success).toBe(false);
    expect(loginSchema.safeParse({ studentCode:"0123456789",pin:"123456",role:"school_admin" }).success).toBe(false);
  });
  it("requires matching PIN confirmation and the current PIN for changes", () => {
    expect(createPinSchema.safeParse({pin:"123456",confirmPin:"123456"}).success).toBe(true);
    expect(createPinSchema.safeParse({pin:"123456",confirmPin:"654321"}).success).toBe(false);
    expect(changePinSchema.safeParse({currentPin:"111111",newPin:"222222",confirmPin:"222222"}).success).toBe(true);
    expect(changePinSchema.safeParse({currentPin:"111111",newPin:"111111",confirmPin:"111111"}).success).toBe(false);
  });
  it("rejects organization fields injected into the student profile", () => {
    const result=studentProfileSchema.safeParse({fullName:"Sinh viên A",gender:"female",phone:"0900000000",classId:"00000000-0000-4000-8000-000000000001",facultyId:"00000000-0000-4000-8000-000000000002"});
    expect(result.success).toBe(false);
  });
});
