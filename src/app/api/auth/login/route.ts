import { NextResponse } from "next/server";
import { apiError, HttpError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { loginSchema } from "@/modules/auth-account/schemas";

const GENERIC_LOGIN_MESSAGE = "MSSV hoặc mật khẩu không đúng, hoặc tài khoản chưa được xác minh.";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));
    const limiter = await enforceAuthRateLimit(request, "login", input.studentCode);
    const admin = createAdminSupabase();

    const { data: account } = await admin
      .from("accounts")
      .select("user_id, status")
      .eq("student_code", input.studentCode)
      .maybeSingle();

    let email: string | null = null;
    if (account?.user_id && account.status !== "suspended") {
      const { data: mapping } = await admin
        .from("account_emails")
        .select("email")
        .eq("user_id", account.user_id)
        .maybeSingle();
      email = mapping?.email ?? null;
    }

    if (!email) {
      await limiter.record(false);
      throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_MESSAGE);
    }

    const supabase = await createUserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    await limiter.record(!error);
    if (error) throw new HttpError(401, "INVALID_CREDENTIALS", GENERIC_LOGIN_MESSAGE);

    return NextResponse.json({ message: "Đăng nhập thành công." });
  } catch (error) {
    return apiError(error);
  }
}
