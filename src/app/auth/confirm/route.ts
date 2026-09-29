import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/onboarding/profile";
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createUserSupabase();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("Missing confirmation token") };

  if (result.error || !result.data.user) {
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  }

  const admin = createAdminSupabase();
  const verifiedEmail = result.data.user.email;
  if (verifiedEmail) {
    await admin.from("account_emails").update({ email: verifiedEmail, verified_at: new Date().toISOString() })
      .eq("user_id", result.data.user.id);
    await admin.from("accounts").update({ status: "active", updated_at: new Date().toISOString() })
      .eq("user_id", result.data.user.id);
    await admin.from("email_change_requests").update({ completed_at: new Date().toISOString() })
      .eq("user_id", result.data.user.id).is("completed_at", null);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
