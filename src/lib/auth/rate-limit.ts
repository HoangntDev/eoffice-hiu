import "server-only";

import { createHash } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import { rateLimitPepper } from "@/lib/env";
import { HttpError } from "@/lib/http";

export type AuthAction = "login" | "register" | "recover";

function digest(value: string) {
  return createHash("sha256").update(rateLimitPepper()).update("\0").update(value).digest("hex");
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export async function enforceAuthRateLimit(request: Request, action: AuthAction, identifier: string) {
  const admin = createAdminSupabase();
  const identifierHash = digest(identifier.toLowerCase());
  const ipHash = digest(clientIp(request));
  const windowStart = new Date(Date.now() - 15 * 60_000).toISOString();
  const limit = action === "login" ? 8 : 5;

  const { count, error } = await admin
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("identifier_hash", identifierHash)
    .eq("ip_hash", ipHash)
    .gte("attempted_at", windowStart);

  if (error) throw new Error("AUTH_RATE_LIMIT_UNAVAILABLE");
  if ((count ?? 0) >= limit) {
    throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Có quá nhiều lần thử. Vui lòng thử lại sau 15 phút.");
  }

  return {
    record: async (succeeded: boolean) => {
      const { error: insertError } = await admin.from("auth_attempts").insert({
        action,
        identifier_hash: identifierHash,
        ip_hash: ipHash,
        succeeded,
      });
      if (insertError) throw new Error("AUTH_ATTEMPT_AUDIT_FAILED");
    },
  };
}
