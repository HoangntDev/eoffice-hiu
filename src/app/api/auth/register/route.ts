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
    const authClient = await createUserSupabase();
    const admin = createAdminSupabase();

    const { data, error } = await authClient.auth.signUp({
      email: input.gmail,
      password: input.password,
      options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=/onboarding/profile` },
    });
    if (error || !data.user) {
      await limiter.record(false);
      throw new HttpError(409, "REGISTRATION_UNAVAILABLE", "Không thể tạo tài khoản với thông tin đã cung cấp.");
    }

    const accountResult = await admin.from("accounts").insert({
      user_id: data.user.id,
      student_code: input.studentCode,
    });
    const emailResult = accountResult.error
      ? accountResult
      : await admin.from("account_emails").insert({ user_id: data.user.id, email: input.gmail });

    if (accountResult.error || emailResult.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      await limiter.record(false);
      throw new HttpError(409, "REGISTRATION_UNAVAILABLE", "Không thể tạo tài khoản với thông tin đã cung cấp.");
    }

    await limiter.record(true);
    return NextResponse.json({
      message: "Đã tạo tài khoản. Hãy mở Gmail để xác minh trước khi đăng nhập.",
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
