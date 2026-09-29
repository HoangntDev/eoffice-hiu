import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, studentCodeSchema } from "@/modules/auth-account/schemas";
import { studentProfileSchema } from "@/modules/student-profile/schemas";

describe("student account validation", () => {
  it("accepts exactly 10 digits and preserves a leading zero", () => {
    expect(studentCodeSchema.parse("0123456789")).toBe("0123456789");
  });
  it("rejects the future 11-digit format today", () => {
    expect(studentCodeSchema.safeParse("01234567890").success).toBe(false);
  });
  it("requires a Gmail address at registration", () => {
    expect(registerSchema.safeParse({ studentCode:"0123456789",gmail:"student@example.com",password:"123456" }).success).toBe(false);
  });
  it("does not accept email or role as login identity", () => {
    expect(loginSchema.safeParse({ studentCode:"student@gmail.com",password:"123456",role:"school_admin" }).success).toBe(false);
  });
  it("rejects organization fields injected into the student profile", () => {
    const result=studentProfileSchema.safeParse({fullName:"Sinh viên A",gender:"female",phone:"0900000000",classId:"00000000-0000-4000-8000-000000000001",facultyId:"00000000-0000-4000-8000-000000000002"});
    expect(result.success).toBe(false);
  });
});
