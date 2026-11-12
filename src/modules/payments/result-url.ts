import { appUrl } from "@/lib/env";

export function paymentResultUrl(orderRef?: string, gatewayError = false): URL {
  const url = new URL("/payments/return", appUrl());
  if (orderRef) url.searchParams.set("order", orderRef);
  if (gatewayError) url.searchParams.set("gateway_error", "1");
  return url;
}
