import type { PaymentGateway, PaymentRequest, VerifiedPaymentIpn } from "./gateway";

export type VnpayConfig = {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
  returnUrl: string;
};

export function signVnpayParams(_params: URLSearchParams, _secret: string): string {
  throw new Error("NOT_IMPLEMENTED");
}

export class VnpayGateway implements PaymentGateway {
  constructor(private readonly _config: VnpayConfig) {}

  async createPaymentUrl(_request: PaymentRequest): Promise<string> {
    throw new Error("NOT_IMPLEMENTED");
  }

  verifyIpn(_params: URLSearchParams): VerifiedPaymentIpn {
    throw new Error("NOT_IMPLEMENTED");
  }
}
