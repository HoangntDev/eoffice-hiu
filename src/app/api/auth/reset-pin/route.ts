import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSessionUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/server";
import { createPinSchema } from "@/modules/auth-account/schemas";

export async function POST(request: Request) {
  try {
    const input = createPinSchema.parse(await readJson(request));
    const { user, supabase } = await requireSessionUser();
    const recoveryToken = (await cookies()).get("pin_recovery")?.value;
    if (!recoveryToken) {
      throw new HttpError(403, "RECOVERY_PROOF_REQUIRED", "Liên kết khôi phục không hợp lệ hoặc đã hết hạn.");
    }
    const admin = createAdminSupabase();
    const tokenHash = createHash("sha256").update(recoveryToken).digest("hex");
    const { data: claimed, error: claimError } = await admin.rpc("claim_pin_recovery", {
      p_user_id: user.id,
      p_token_hash: tokenHash,
    });
    if (claimError || claimed !== true) {
      throw new HttpError(403, "RECOVERY_PROOF_REQUIRED", "Liên kết khôi phục không hợp lệ hoặc đã hết hạn.");
    }

    const { error } = await supabase.auth.updateUser({ password: input.pin });
    if (error) throw new HttpError(400, "PIN_RESET_FAILED", "Không thể đặt lại PIN.");
    await admin.from("audit_events").insert({
      actor_user_id: user.id,
      action: "account.pin_recovered",
      target_type: "account",
      target_id: user.id,
    });
    const response = NextResponse.json({ message: "Đã đặt lại PIN.", next: "/onboarding/profile" });
    response.cookies.delete("pin_recovery");
    return response;
  } catch (error) {
    return apiError(error);
  }
}
