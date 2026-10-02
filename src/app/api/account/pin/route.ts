import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/server";
import { changePinSchema } from "@/modules/auth-account/schemas";

export async function PATCH(request: Request) {
  try {
    const input = changePinSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const limiter = await enforceAuthRateLimit(request, "pin_change", user.id);
    const admin = createAdminSupabase();
    const { data: mapping } = await admin.from("account_emails")
      .select("email, verified_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!mapping?.email || !mapping.verified_at) {
      await limiter.record(false);
      throw new HttpError(400, "PIN_CHANGE_FAILED", "Không thể đổi PIN.");
    }

    const verifier = createPublicSupabase();
    const { error: verificationError } = await verifier.auth.signInWithPassword({
      email: mapping.email,
      password: input.currentPin,
    });
    if (verificationError) {
      await limiter.record(false);
      throw new HttpError(400, "PIN_CHANGE_FAILED", "PIN hiện tại không đúng hoặc không thể đổi PIN.");
    }

    const { error } = await supabase.auth.updateUser({ password: input.newPin });
    await limiter.record(!error);
    if (error) throw new HttpError(400, "PIN_CHANGE_FAILED", "Không thể đổi PIN.");
    await admin.from("audit_events").insert({
      actor_user_id: user.id,
      action: "account.pin_changed",
      target_type: "account",
      target_id: user.id,
    });
    return NextResponse.json({ message: "Đã đổi PIN." });
  } catch (error) {
    return apiError(error);
  }
}
