import type { PaypalCapture, PaypalPaymentGateway } from "./gateway";
import type { IpnResponse } from "./ipn";

export type PaypalCaptureExpectation = {
  orderRef: string;
  amountUsd: string;
  currency: "USD";
};

export type PaypalCaptureRecorder = (capture: PaypalCapture) => Promise<IpnResponse>;

export async function processPaypalCapture(
  gateway: Pick<PaypalPaymentGateway, "captureOrder">,
  providerOrderId: string,
  expected: PaypalCaptureExpectation,
  record: PaypalCaptureRecorder,
  observe?: (capture: PaypalCapture) => void,
): Promise<IpnResponse> {
  try {
    const capture = await gateway.captureOrder(providerOrderId);
    observe?.(capture);
    if (capture.status !== "COMPLETED") {
      return { RspCode: "99", Message: "Payment not completed" };
    }
    if (
      capture.providerOrderId !== providerOrderId
      || capture.customId !== expected.orderRef
      || capture.currency !== expected.currency
      || capture.amountUsd !== expected.amountUsd
    ) {
      return { RspCode: "04", Message: "Invalid payment details" };
    }
    return await record(capture);
  } catch {
    return { RspCode: "99", Message: "Payment gateway unavailable" };
  }
}
