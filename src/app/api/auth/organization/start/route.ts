import { NextResponse } from "next/server";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { setPendingOrganizationLogin } from "@/lib/auth/organization-login";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { clientIp } from "@/lib/request-meta";
import { createAdminSupabase } from "@/lib/supabase/server";
import { organizationLoginFailure } from "@/modules/organization-auth/policy";
import { parseOrganizationLoginStep1 } from "@/modules/organization-auth/schemas";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let organizationId: string | undefined;
  try {
    const input = parseOrganizationLoginStep1(await readJson(request));
    organizationId = input.organizationId;
    const limiter = await enforceAuthRateLimit(request, "org_login", input.organizationId);
    const admin = createAdminSupabase();
    const { data: challengeId, error } = await admin.rpc("start_organization_login", {
      p_organization_id: input.organizationId,
      p_pin: input.organizationPin,
    });
    const succeeded = !error && typeof challengeId === "string";
    await limiter.record(succeeded);
    if (!succeeded) {
      const failure = organizationLoginFailure("wrong_organization_pin");
      throw new HttpError(failure.status, failure.code, failure.message);
    }
    await setPendingOrganizationLogin(challengeId);
    logEvent("info", "auth.organization_login_step1", {
      requestId, organizationId: input.organizationId, ip: clientIp(request.headers), result: "ok",
    });
    return NextResponse.json({ next: "/admin/login/officer" });
  } catch (error) {
    if (error instanceof HttpError && ["INVALID_CREDENTIALS", "TOO_MANY_ATTEMPTS"].includes(error.code)) {
      logEvent("warn", "auth.organization_login_step1", {
        requestId, organizationId, ip: clientIp(request.headers), result: "failed", reason: error.code,
      });
    }
    return apiError(error);
  }
}
