import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/server";
import { createPinSchema } from "@/modules/auth-account/schemas";

export async function POST(request: Request) {
  try {
    const input = createPinSchema.parse(await readJson(request));
    const { user, supabase } = await requireSessionUser();
    const admin = createAdminSupabase();
    const [{ data: account }, { data: email }] = await Promise.all([
      admin.from("accounts").select("status").eq("user_id", user.id).maybeSingle(),
      admin.from("account_emails").select("verified_at").eq("user_id", user.id).maybeSingle(),
    ]);
    if (account?.status !== "pending_pin" || !email?.verified_at) {
      throw new HttpError(403, "PIN_CREATION_NOT_ALLOWED", "Tài khoản không ở bước tạo PIN.");
    }

    const { error } = await supabase.auth.updateUser({ password: input.pin });
    if (error) throw new HttpError(400, "PIN_CREATE_FAILED", "Không thể tạo PIN.");
    const { error: accountError } = await admin.from("accounts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "pending_pin");
    if (accountError) throw new Error("ACCOUNT_ACTIVATION_FAILED");
    await admin.from("audit_events").insert({
      actor_user_id: user.id,
      action: "account.pin_created",
      target_type: "account",
      target_id: user.id,
    });
    return NextResponse.json({ message: "Đã tạo PIN.", next: "/onboarding/profile" });
  } catch (error) {
    return apiError(error);
  }
}
