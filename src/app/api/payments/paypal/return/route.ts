import { NextResponse } from "next/server";
import { appUrl, paypalEnv } from "@/lib/env";
import { errorFields, logEvent, requestIdFrom } from "@/lib/log";
import { createAdminSupabase } from "@/lib/supabase/server";
import { processPaypalCapture } from "@/modules/payments/paypal";
import { PaypalGateway } from "@/modules/payments/paypal-gateway";
import type { PaypalCapture } from "@/modules/payments/gateway";

function resultUrl(orderRef?: string, gatewayError = false): URL {
  const url = new URL("/payments/return", appUrl());
  if (orderRef) url.searchParams.set("order", orderRef);
  if (gatewayError) url.searchParams.set("gateway_error", "1");
  return url;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const providerOrderId = new URL(request.url).searchParams.get("token")?.trim();
  if (!providerOrderId) return NextResponse.redirect(resultUrl());
  const admin = createAdminSupabase();
  const { data: order } = await admin.from("union_fee_orders")
    .select("order_ref, status, provider_currency, provider_amount")
    .eq("provider", "paypal")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (!order) {
    logEvent("warn", "payment.paypal_return_unknown", { requestId, providerOrderId });
    return NextResponse.redirect(resultUrl());
  }
  if (order.status !== "pending") {
    return NextResponse.redirect(resultUrl(order.order_ref));
  }

  try {
    let observedCapture: PaypalCapture | undefined;
    const result = await processPaypalCapture(
      new PaypalGateway(paypalEnv()),
      providerOrderId,
      {
        orderRef: order.order_ref,
        amountUsd: Number(order.provider_amount).toFixed(2),
        currency: "USD",
      },
      async (capture) => {
        const { data, error } = await admin.rpc("record_union_fee_paypal_capture", {
          p_order_ref: order.order_ref,
          p_paypal_order_id: capture.providerOrderId,
          p_capture_id: capture.captureId,
          p_custom_id: capture.customId,
          p_amount_usd: capture.amountUsd,
          p_currency: capture.currency,
          p_status: capture.status,
          p_paid_at: capture.paidAt?.toISOString() ?? null,
          p_request_id: requestId,
        });
        const code = !error && typeof data === "string" ? data : "99";
        return { RspCode: code, Message: code === "00" ? "Confirm Success" : "Payment rejected" };
      },
      (capture) => { observedCapture = capture; },
    );
    const { data: saved } = await admin.from("union_fee_orders")
      .select("provider_capture_id, transaction_ref")
      .eq("order_ref", order.order_ref)
      .maybeSingle();
    logEvent(result.RspCode === "00" || result.RspCode === "02" ? "info" : "warn", "payment.paypal_capture", {
      requestId,
      orderRef: order.order_ref,
      providerOrderId,
      captureId: observedCapture?.captureId ?? saved?.provider_capture_id ?? saved?.transaction_ref,
      status: observedCapture?.status ?? result.RspCode,
      result: result.RspCode,
      amountUsd: observedCapture?.amountUsd ?? Number(order.provider_amount).toFixed(2),
      currency: observedCapture?.currency ?? order.provider_currency,
    });
    const gatewayError = result.RspCode === "99" && !observedCapture;
    return NextResponse.redirect(resultUrl(order.order_ref, gatewayError));
  } catch (error) {
    logEvent("error", "payment.paypal_capture_failed", {
      requestId, orderRef: order.order_ref, providerOrderId, ...errorFields(error),
    });
    return NextResponse.redirect(resultUrl(order.order_ref, true));
  }
}
