import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { parseMonthlyAmount } from "@/modules/payments/fee";

const schema = z.object({ calendarYear: z.number().int().min(2000).max(2100), monthlyAmount: z.number().int() }).strict();

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const input = schema.parse(await readJson(request));
    const amount = parseMonthlyAmount(input.monthlyAmount);
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("create_union_fee_campaign", {
      p_calendar_year: input.calendarYear,
      p_monthly_amount: amount,
      p_request_id: requestId,
    });
    if (error) {
      if (error.message.includes("CAMPAIGN_ALREADY_EXISTS")) throw new HttpError(409, "CAMPAIGN_ALREADY_EXISTS", "Khoa đã có khoản thu cho năm này.");
      if (error.message.includes("PAYMENT_DISABLED")) throw new HttpError(404, "PAYMENT_DISABLED", "Chức năng thanh toán đang tắt.");
      throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền tạo khoản thu cho Khoa này.");
    }
    logEvent("info", "payment.campaign_created", { requestId, userId: user.id, campaignId: data, calendarYear: input.calendarYear, monthlyAmount: amount });
    return NextResponse.json({ id: data }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
