import { createHash, randomBytes } from "node:crypto";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/env";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";

type ConfirmationFlow = "signup" | "finish-signup" | "recovery" | "change-email";

function confirmationFlow(value: string | null): ConfirmationFlow | null {
  return value === "signup" || value === "finish-signup" || value === "recovery" || value === "change-email"
    ? value
    : null;
}

function failurePath(flow: ConfirmationFlow | null) {
  if (flow === "signup") return "/register?error=confirmation";
  if (flow === "finish-signup") return "/login?error=confirmation";
  if (flow === "recovery") return "/auth/recover?error=confirmation";
  if (flow === "change-email") return "/account/security?error=confirmation";
  return "/login?error=confirmation";
}

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

async function completeSignup(user: User, flow: "signup" | "finish-signup") {
  const email = user.email?.toLowerCase();
  if (!email) return false;
  const admin = createAdminSupabase();

  if (flow === "signup") {
    const { error } = await admin.rpc("complete_account_registration", {
      p_user_id: user.id,
      p_gmail: email,
    });
    return !error;
  }

  const [{ data: account }, { data: mapping }] = await Promise.all([
    admin.from("accounts").select("status").eq("user_id", user.id).maybeSingle(),
    admin.from("account_emails").select("email, verified_at").eq("user_id", user.id).maybeSingle(),
  ]);
  return account?.status === "pending_pin"
    && mapping?.email?.toLowerCase() === email
    && Boolean(mapping.verified_at);
}

async function completeEmailChange(user: User) {
  const email = user.email?.toLowerCase();
  if (!email) return null;
  const admin = createAdminSupabase();
  const [{ data: changeRequest }, { data: currentMapping }] = await Promise.all([
    admin.from("email_change_requests")
      .select("id, requested_email")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .maybeSingle(),
    admin.from("account_emails").select("email").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!changeRequest) return null;
  if (changeRequest.requested_email?.toLowerCase() !== email) {
    return currentMapping?.email?.toLowerCase() === email ? "pending" : null;
  }

  const { error } = await admin.from("account_emails")
    .update({ email, verified_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return null;
  await admin.from("email_change_requests").update({ completed_at: new Date().toISOString() })
    .eq("id", changeRequest.id);
  return "updated";
}

async function authorizePinRecovery(user: User) {
  const email = user.email?.toLowerCase();
  if (!email) return null;
  const admin = createAdminSupabase();
  const [{ data: account }, { data: mapping }] = await Promise.all([
    admin.from("accounts").select("status").eq("user_id", user.id).maybeSingle(),
    admin.from("account_emails").select("email, verified_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if (account?.status !== "active" || mapping?.email?.toLowerCase() !== email || !mapping.verified_at) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  await admin.from("pin_recovery_authorizations").delete()
    .eq("user_id", user.id)
    .lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("pin_recovery_authorizations").insert({
    token_hash: tokenHash,
    user_id: user.id,
    expires_at: expiresAt,
  });
  return error ? null : token;
}

export async function handleConfirmation(request: NextRequest) {
  const flow = confirmationFlow(request.nextUrl.searchParams.get("flow"));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const confirmationMessage = request.nextUrl.searchParams.get("message");
  if (flow === "change-email" && confirmationMessage && !code && !tokenHash) {
    return redirect(request, "/account/security?email=pending");
  }
  const supabase = await createUserSupabase();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { user: null }, error: new Error("Missing confirmation token") };

  if (!flow || result.error || !result.data.user) {
    return redirect(request, failurePath(flow));
  }

  if (flow === "signup" || flow === "finish-signup") {
    return await completeSignup(result.data.user, flow)
      ? redirect(request, "/signup/create-pin")
      : redirect(request, failurePath(flow));
  }
  if (flow === "change-email") {
    const emailChange = await completeEmailChange(result.data.user);
    if (emailChange === "updated") return redirect(request, "/account/security?email=updated");
    if (emailChange === "pending") return redirect(request, "/account/security?email=pending");
    return redirect(request, failurePath(flow));
  }

  const recoveryToken = await authorizePinRecovery(result.data.user);
  if (!recoveryToken) return redirect(request, failurePath(flow));
  const response = redirect(request, "/account/recover-pin");
  response.cookies.set("pin_recovery", recoveryToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    maxAge: 15 * 60,
    path: "/",
  });
  return response;
}
