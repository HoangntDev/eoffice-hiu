import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { apiError, readJson } from "@/lib/http";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { recoverSchema } from "@/modules/auth-account/schemas";

const GENERIC_MESSAGE = "Nếu tài khoản hợp lệ, hướng dẫn khôi phục PIN sẽ được gửi tới Gmail đã xác minh.";

export async function POST(request: Request) {
  try {
    const input = recoverSchema.parse(await readJson(request));
    const limiter = await enforceAuthRateLimit(request, "recover", input.studentCode);
    const admin = createAdminSupabase();
    const { data: account } = await admin.from("accounts").select("user_id, status").eq("student_code", input.studentCode).maybeSingle();
    if (account?.user_id && account.status === "active") {
      const { data: mapping } = await admin.from("account_emails").select("email, verified_at").eq("user_id", account.user_id).maybeSingle();
      if (mapping?.email && mapping.verified_at) {
        const authClient = await createUserSupabase();
        await authClient.auth.resetPasswordForEmail(mapping.email, {
          redirectTo: `${appUrl()}/auth/confirm?flow=recovery`,
        });
      }
    }
    await limiter.record(true);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    return apiError(error);
  }
}
