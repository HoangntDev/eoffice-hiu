import { NextResponse } from "next/server";
import {
  clearPendingOrganizationLogin,
  pendingOrganizationLoginId,
  sessionIdOf,
  verifyPersonalPin,
} from "@/lib/auth/organization-login";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { clientIp } from "@/lib/request-meta";
import { createAdminSupabase, createUserSupabase } from "@/lib/supabase/server";
import { organizationLoginFailure } from "@/modules/organization-auth/policy";
import { parseOfficerLoginStep2 } from "@/modules/organization-auth/schemas";

function invalidCredentials() {
  const failure = organizationLoginFailure("wrong_personal_pin");
  return new HttpError(failure.status, failure.code, failure.message);
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let studentCode: string | undefined;
  let organizationId: string | undefined;
  try {
    const input = parseOfficerLoginStep2(await readJson(request));
    studentCode = input.studentCode;
    const challengeId = await pendingOrganizationLoginId();
    if (!challengeId) throw invalidCredentials();

    const limiter = await enforceAuthRateLimit(request, "login", input.studentCode);
    const admin = createAdminSupabase();
    const { data: accountUserId } = await admin.rpc("read_organization_login", {
      p_challenge_id: challengeId,
      p_consume: false,
    });
    if (typeof accountUserId !== "string") {
      await limiter.record(false);
      throw invalidCredentials();
    }

    const [{ data: organizationAccount }, { data: officer }] = await Promise.all([
      admin.from("accounts").select("organization_id").eq("user_id", accountUserId).maybeSingle(),
      admin.from("accounts").select("user_id, status").eq("student_code", input.studentCode).maybeSingle(),
    ]);
    organizationId = organizationAccount?.organization_id ?? undefined;
    if (!officer?.user_id || officer.status !== "active") {
      await limiter.record(false);
      throw invalidCredentials();
    }
    const { data: emailRow } = await admin
      .from("account_emails")
      .select("email, verified_at")
      .eq("user_id", officer.user_id)
      .maybeSingle();
    const personalOk = Boolean(emailRow?.email && emailRow.verified_at)
      && await verifyPersonalPin(emailRow!.email, input.pin);
    const { data: memberId } = personalOk
      ? await admin.rpc("organization_member_for", {
        p_account_user_id: accountUserId,
        p_officer_user_id: officer.user_id,
      })
      : { data: null };
    if (!personalOk || typeof memberId !== "string") {
      await limiter.record(false);
      throw invalidCredentials();
    }

    const { data: authUser } = await admin.auth.admin.getUserById(accountUserId);
    const organizationEmail = authUser.user?.email;
    if (!organizationEmail) throw new Error("ORGANIZATION_AUTH_EMAIL_MISSING");
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: organizationEmail,
    });
    if (linkError) throw linkError;

    const supabase = await createUserSupabase();
    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
    const sessionId = verified.session?.access_token ? sessionIdOf(verified.session.access_token) : null;
    if (verifyError || !sessionId) throw new Error("ORGANIZATION_SESSION_CREATE_FAILED");

    const { error: officerError } = await admin.rpc("start_officer_session", {
      p_session_id: sessionId,
      p_account_user_id: accountUserId,
      p_officer_user_id: officer.user_id,
    });
    if (officerError) {
      await supabase.auth.signOut({ scope: "local" });
      throw officerError;
    }
    await admin.rpc("read_organization_login", { p_challenge_id: challengeId, p_consume: true });
    await clearPendingOrganizationLogin();
    await limiter.record(true);
    logEvent("info", "auth.organization_login_succeeded", {
      requestId, organizationId, studentCode: input.studentCode, ip: clientIp(request.headers), result: "ok",
    });
    return NextResponse.json({ next: "/admin" });
  } catch (error) {
    if (error instanceof HttpError && ["INVALID_CREDENTIALS", "TOO_MANY_ATTEMPTS"].includes(error.code)) {
      logEvent("warn", "auth.organization_login_failed", {
        requestId, organizationId, studentCode, ip: clientIp(request.headers), result: "failed", reason: error.code,
      });
    }
    return apiError(error);
  }
}
