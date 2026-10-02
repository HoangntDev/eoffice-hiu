import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { apiError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { registerSchema } from "@/modules/auth-account/schemas";

const GENERIC_MESSAGE = "Nếu thông tin đăng ký đang chờ xác thực, email mới đã được gửi.";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await readJson(request));
    const limiter = await enforceAuthRateLimit(request, "register", input.studentCode);
    const admin = createAdminSupabase();
    const { data: pending } = await admin
      .from("pending_account_registrations")
      .select("id")
      .eq("student_code", input.studentCode)
      .eq("gmail", input.gmail)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pending) {
      const authClient = await createUserSupabase();
      await authClient.auth.signInWithOtp({
        email: input.gmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${appUrl()}/auth/confirm?flow=signup`,
        },
      });
    }
    await limiter.record(true);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    return apiError(error);
  }
}
