import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/server";
import { pinSchema } from "@/modules/auth-account/schemas";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const { pin } = z.object({ pin: pinSchema }).parse(await readJson(request));
    const { user } = await requireUser();
    const limiter = await enforceAuthRateLimit(request, "pin_change", user.id);
    const admin = createAdminSupabase();
    const { data: mapping } = await admin
      .from("account_emails")
      .select("email, verified_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!mapping?.email || !mapping.verified_at) {
      await limiter.record(false);
      throw new HttpError(400, "VERIFY_PIN_FAILED", "Không thể xác minh PIN.");
    }
    const verifier = createPublicSupabase();
    const { error } = await verifier.auth.signInWithPassword({
      email: mapping.email,
      password: pin,
    });
    if (error) {
      await limiter.record(false);
      throw new HttpError(400, "VERIFY_PIN_FAILED", "PIN không đúng.");
    }
    await limiter.record(true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
