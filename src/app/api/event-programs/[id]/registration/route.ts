import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import { saveRegistrationSettingsSchema } from "@/modules/program-registrations/schemas";

// BTC (Đoàn Khoa sở hữu chương trình) lưu cấu hình đăng ký; RPC kiểm quyền, trạng thái chương trình và chỉ tiêu.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = saveRegistrationSettingsSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("save_program_registration_settings", {
      p_program_id: id,
      p_audience_rule: input.audienceRule,
      p_capacity: input.capacity ?? null,
      p_requires_approval: input.requiresApproval,
      p_form_id: input.formId ?? null,
      p_closes_at: input.closesAt ?? null,
      p_quota_release_at: input.quotaReleaseAt ?? null,
      p_instructions: input.instructions,
      p_quotas: input.quotas.map((q) => ({
        id: q.id ?? null, label: q.label, audience_rule: q.audienceRule, seats: q.seats, sort_order: q.sortOrder,
      })),
      p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_registration.settings_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw registrationRpcError(error.message);
    }
    logEvent("info", "program_registration.settings_saved", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ message: "Đã lưu cấu hình đăng ký." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
