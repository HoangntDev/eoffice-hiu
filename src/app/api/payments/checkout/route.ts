import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { configuredPaymentProvider, paypalEnv, vnpayEnv } from "@/lib/env";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { clientIp } from "@/lib/request-meta";
import { createAdminSupabase } from "@/lib/supabase/server";
import { PaypalGateway } from "@/modules/payments/paypal-gateway";
import { resolvePaymentProvider } from "@/modules/payments/provider";
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
      .select("order_ref, amount, created_at, provider, provider_order_id, provider_currency, provider_amount, provider_approval_url, union_fee_campaigns(calendar_year)")
      .eq("id", orderId).single();
    if (orderError || !order) throw new Error("PAYMENT_ORDER_NOT_FOUND_AFTER_CREATE");
    const campaign = order.union_fee_campaigns as unknown as { calendar_year: number };
    let provider;
    try {
      provider = resolvePaymentProvider(configuredPaymentProvider());
    } catch {
      throw new Error("CONFIG_INVALID:PAYMENT_PROVIDER");
    }
    let paymentUrl: string;
    let providerOrderId: string | null = null;
    let amountUsd: string | null = null;
    const paymentRequest = {
      orderRef: order.order_ref,
      amountVnd: order.amount,
      orderInfo: `Doan phi nam ${campaign.calendar_year}`,
      ipAddress: clientIp(request.headers),
      createdAt: new Date(order.created_at),
    };
    if (provider === "paypal") {
      if (order.provider === "paypal" && order.provider_order_id && order.provider_approval_url) {
        paymentUrl = order.provider_approval_url;
        providerOrderId = order.provider_order_id;
        amountUsd = order.provider_amount == null ? null : Number(order.provider_amount).toFixed(2);
      } else {
        try {
          const paypalOrder = await new PaypalGateway(paypalEnv()).createPaypalOrder(paymentRequest);
          const admin = createAdminSupabase();
          const { data: bindCode, error: bindError } = await admin.rpc("bind_union_fee_paypal_order", {
            p_order_ref: order.order_ref,
            p_paypal_order_id: paypalOrder.providerOrderId,
            p_amount_usd: paypalOrder.amountUsd,
            p_currency: paypalOrder.currency,
            p_approval_url: paypalOrder.approvalUrl,
            p_request_id: requestId,
          });
          if (bindError || bindCode !== "00") throw new Error("PAYPAL_ORDER_BIND_FAILED");
          paymentUrl = paypalOrder.approvalUrl;
          providerOrderId = paypalOrder.providerOrderId;
          amountUsd = paypalOrder.amountUsd;
        } catch (error) {
          if (error instanceof Error && /^(MISSING_ENV|CONFIG_INVALID):/.test(error.message)) throw error;
          throw new HttpError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "PayPal đang bận. Vui lòng thử lại sau.");
        }
      }
    } else {
      if (order.provider === "paypal" && order.provider_order_id) {
        throw new HttpError(409, "PAYMENT_PROVIDER_CHANGED", "Đơn đang chờ PayPal. Vui lòng thử lại sau khi đơn hết hạn.");
      }
      try {
        paymentUrl = await withTimeout(new VnpayGateway(vnpayEnv()).createPaymentUrl(paymentRequest));
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("MISSING_ENV:")) throw error;
        throw new HttpError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "VNPay đang bận. Vui lòng thử lại sau.");
      }
    }
    const { data: account } = await supabase.from("accounts").select("student_code").eq("user_id", user.id).maybeSingle();
    logEvent("info", "payment.checkout_started", {
      requestId, studentCode: account?.student_code, orderRef: order.order_ref, provider,
      providerOrderId, amountVnd: order.amount, amountUsd,
    });
    return NextResponse.json({ paymentUrl }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
