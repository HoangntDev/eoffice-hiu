import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { vnpayEnv } from "@/lib/env";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { clientIp } from "@/lib/request-meta";
import { VnpayGateway } from "@/modules/payments/vnpay-gateway";

const schema = z.object({ campaignId: z.string().uuid() }).strict();
const GATEWAY_TIMEOUT_MS = 5_000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("PAYMENT_GATEWAY_TIMEOUT")), GATEWAY_TIMEOUT_MS); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const input = schema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data: orderId, error: createError } = await supabase.rpc("create_union_fee_order", {
      p_campaign_id: input.campaignId,
      p_request_id: requestId,
    });
    if (createError) {
      if (createError.message.includes("ALREADY_PAID")) throw new HttpError(409, "ALREADY_PAID", "Bạn đã đóng đủ Đoàn phí năm này.");
      if (createError.message.includes("PAYMENT_DISABLED")) throw new HttpError(404, "PAYMENT_DISABLED", "Chức năng thanh toán đang tắt.");
      throw new HttpError(403, "FORBIDDEN", "Khoản thu không thuộc Khoa của bạn.");
    }
    const { data: order, error: orderError } = await supabase
      .from("union_fee_orders")
      .select("order_ref, amount, created_at, union_fee_campaigns(calendar_year)")
      .eq("id", orderId).single();
    if (orderError || !order) throw new Error("PAYMENT_ORDER_NOT_FOUND_AFTER_CREATE");
    const campaign = order.union_fee_campaigns as unknown as { calendar_year: number };
    const gateway = new VnpayGateway(vnpayEnv());
    let paymentUrl: string;
    try {
      paymentUrl = await withTimeout(gateway.createPaymentUrl({
        orderRef: order.order_ref,
        amountVnd: order.amount,
        orderInfo: `Doan phi nam ${campaign.calendar_year}`,
        ipAddress: clientIp(request.headers),
        createdAt: new Date(order.created_at),
      }));
    } catch {
      throw new HttpError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "Cổng thanh toán đang bận. Vui lòng thử lại sau.");
    }
    const { data: account } = await supabase.from("accounts").select("student_code").eq("user_id", user.id).maybeSingle();
    logEvent("info", "payment.checkout_started", {
      requestId, studentCode: account?.student_code, orderRef: order.order_ref, amountVnd: order.amount,
    });
    return NextResponse.json({ paymentUrl }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
