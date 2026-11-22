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
  it("requires a @student.hiu.vn email matching the MSSV at registration", () => {
    // MSSV 0123456789 → email number must end with "012" + "6789"
    expect(registerSchema.safeParse({ dataConsent:true, studentCode:"0123456789",gmail:"student@example.com" }).success).toBe(false);
    expect(registerSchema.safeParse({ dataConsent:true, studentCode:"0123456789",gmail:"an0126789@gmail.com" }).success).toBe(false);
    expect(registerSchema.safeParse({ dataConsent:true, studentCode:"0123456789",gmail:"an0129999@student.hiu.vn" }).success).toBe(false);
    expect(registerSchema.safeParse({ dataConsent:true, studentCode:"0123456789",gmail:"an0126789@student.hiu.vn" }).success).toBe(true);
  });
  it("requires explicit consent for a new registration", () => {
    const identity = { studentCode: "8880001234", gmail: "demo8881234@student.hiu.vn" };
    expect(registerSchema.safeParse(identity).success).toBe(false);
    expect(registerSchema.safeParse({ ...identity, dataConsent: false }).success).toBe(false);
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
