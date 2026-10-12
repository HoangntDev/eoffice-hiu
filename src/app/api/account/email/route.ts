import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/server";
import { changeEmailSchema } from "@/modules/auth-account/schemas";

export async function PATCH(request: Request) {
  try {
    const input = changeEmailSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.auth.updateUser(
      { email: input.gmail },
      { emailRedirectTo: `${appUrl()}/auth/confirm?flow=change-email` },
    );
    if (error) throw new HttpError(409, "EMAIL_CHANGE_UNAVAILABLE", "Không thể bắt đầu đổi email sinh viên.");

    const admin = createAdminSupabase();
    await admin.from("email_change_requests").delete().eq("user_id", user.id).is("completed_at", null);
    const { error: insertError } = await admin.from("email_change_requests").insert({
      user_id: user.id,
      requested_email: input.gmail,
    });
    if (insertError) throw new Error("EMAIL_CHANGE_AUDIT_FAILED");

    return NextResponse.json({
      message: "Đã gửi yêu cầu xác minh. Email đang dùng chỉ đổi sau khi quy trình xác nhận hoàn tất.",
    });
  } catch (error) {
    return apiError(error);
  }
}
