import "server-only";

import { createHash } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import { rateLimitPepper } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { clientIp } from "@/lib/request-meta";

export type AuthAction = "login" | "register" | "recover" | "pin_change" | "org_login";

function digest(value: string) {
  return createHash("sha256").update(rateLimitPepper()).update("\0").update(value).digest("hex");
}

// Supabase từ chối service role key (401/403) là lỗi cấu hình, không phải lỗi tạm thời (INC-01, K1b).
function rateLimitError(status: number, fallback = "AUTH_RATE_LIMIT_UNAVAILABLE") {
  return new Error(status === 401 || status === 403 ? "CONFIG_INVALID:SUPABASE_SERVICE_ROLE_KEY" : fallback);
}

export async function enforceAuthRateLimit(request: Request, action: AuthAction, identifier: string) {
  const admin = createAdminSupabase();
  const identifierHash = digest(identifier.toLowerCase());
  const ipHash = digest(clientIp(request.headers));
  const windowStart = new Date(Date.now() - 15 * 60_000).toISOString();
  const limit = action === "login" ? 8 : 5;

  const { count, error, status } = await admin
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("identifier_hash", identifierHash)
    .eq("ip_hash", ipHash)
    .eq("succeeded", false)
    .gte("attempted_at", windowStart);

  if (error) throw rateLimitError(status);
  if ((count ?? 0) >= limit) {
    throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Có quá nhiều lần thử. Vui lòng thử lại sau 15 phút.");
  }

  return {
    record: async (succeeded: boolean) => {
      const { error: insertError, status: insertStatus } = await admin.from("auth_attempts").insert({
        action,
        identifier_hash: identifierHash,
        ip_hash: ipHash,
        succeeded,
      });
      if (insertError) throw rateLimitError(insertStatus, "AUTH_ATTEMPT_AUDIT_FAILED");
    },
  };
}
