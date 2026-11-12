import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { logEvent, requestIdFrom } from "@/lib/log";
import { createAdminSupabase } from "@/lib/supabase/server";

function resultUrl(orderRef?: string): URL {
  const url = new URL("/payments/return", appUrl());
  if (orderRef) url.searchParams.set("order", orderRef);
  return url;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const providerOrderId = new URL(request.url).searchParams.get("token")?.trim();
  if (!providerOrderId) return NextResponse.redirect(resultUrl());
  const admin = createAdminSupabase();
  const { data: order } = await admin.from("union_fee_orders")
    .select("order_ref, amount, status")
    .eq("provider", "paypal")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (!order) return NextResponse.redirect(resultUrl());
  if (order.status === "pending") {
    const { data: code } = await admin.rpc("record_union_fee_ipn", {
      p_order_ref: order.order_ref,
      p_amount: order.amount,
      p_transaction_ref: providerOrderId,
      p_response_code: "24",
      p_transaction_status: "11",
      p_paid_at: null,
      p_request_id: requestId,
    });
    logEvent(code === "00" ? "info" : "warn", "payment.paypal_cancelled", {
      requestId, orderRef: order.order_ref, providerOrderId, status: code,
    });
  }
  return NextResponse.redirect(resultUrl(order.order_ref));
}
