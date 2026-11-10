import { NextResponse } from "next/server";
import { vnpayEnv } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { errorFields, logEvent, requestIdFrom } from "@/lib/log";
import { VnpayGateway } from "@/modules/payments/vnpay-gateway";

const messages: Record<string, string> = {
  "00": "Confirm Success",
  "01": "Order not found",
  "02": "Order already confirmed",
  "04": "Invalid amount",
  "97": "Invalid signature",
  "99": "Unknown error",
};

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const gateway = new VnpayGateway(vnpayEnv());
    const params = new URL(request.url).searchParams;
    const ipn = gateway.verifyIpn(params);
    if (!ipn.signatureValid) {
      logEvent("warn", "payment.ipn_rejected", {
        requestId, orderRef: ipn.orderRef, transactionRef: ipn.transactionRef,
        signatureValid: false, amountVnd: ipn.amountVnd, result: "97",
      });
      return NextResponse.json({ RspCode: "97", Message: messages["97"] });
    }
    const admin = createAdminSupabase();
    const { data, error } = await admin.rpc("record_union_fee_ipn", {
      p_order_ref: ipn.orderRef,
      p_amount: ipn.amountVnd,
      p_transaction_ref: ipn.transactionRef,
      p_response_code: ipn.responseCode,
      p_transaction_status: ipn.transactionStatus,
      p_paid_at: ipn.paidAt?.toISOString() ?? null,
      p_request_id: requestId,
    });
    const code = !error && typeof data === "string" && data in messages ? data : "99";
    logEvent(code === "00" || code === "02" ? "info" : "warn", "payment.ipn_processed", {
      requestId, orderRef: ipn.orderRef, transactionRef: ipn.transactionRef,
      signatureValid: true, amountVnd: ipn.amountVnd, responseCode: ipn.responseCode,
      transactionStatus: ipn.transactionStatus, result: code,
    });
    return NextResponse.json({ RspCode: code, Message: messages[code] });
  } catch (error) {
    logEvent("error", "payment.ipn_failed", { requestId, ...errorFields(error) });
    return NextResponse.json({ RspCode: "99", Message: messages["99"] });
  }
}
