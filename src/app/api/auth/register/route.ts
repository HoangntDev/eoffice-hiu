import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { apiError, HttpError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { registerSchema } from "@/modules/auth-account/schemas";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await readJson(request));
    const limiter = await enforceAuthRateLimit(request, "register", input.studentCode);
    const admin = createAdminSupabase();
    const { data: reserved, error: reservationError } = await admin.rpc(
      "reserve_account_registration",
      { p_student_code: input.studentCode, p_gmail: input.gmail },
    );
    if (reservationError || reserved !== true) {
      await limiter.record(false);
      throw new HttpError(409, "REGISTRATION_UNAVAILABLE", "Không thể tạo tài khoản với thông tin đã cung cấp.");
    }

    const authClient = await createUserSupabase();
    const { error } = await authClient.auth.signInWithOtp({
      email: input.gmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${appUrl()}/auth/confirm?flow=signup`,
      },
    });
    if (error) {
      await admin.from("pending_account_registrations").delete()
        .eq("student_code", input.studentCode)
        .eq("gmail", input.gmail)
        .is("consumed_at", null);
      await limiter.record(false);
      throw new HttpError(409, "REGISTRATION_UNAVAILABLE", "Không thể tạo tài khoản với thông tin đã cung cấp.");
    }

    await limiter.record(true);
    return NextResponse.json({
      message: "Đã gửi email xác thực. Hãy mở liên kết trong Gmail, sau đó tạo PIN 6 chữ số.",
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
