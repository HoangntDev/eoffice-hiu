export type PaymentProvider = "vnpay" | "paypal";

export function resolvePaymentProvider(value: string | undefined): PaymentProvider {
  const normalized = value?.trim().toLowerCase() || "vnpay";
  if (normalized !== "vnpay" && normalized !== "paypal") {
    throw new Error("INVALID_PAYMENT_PROVIDER");
  }
  return normalized;
}
