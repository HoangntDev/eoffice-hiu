import type { PaymentGateway, PaymentRequest, VerifiedPaymentIpn } from "./gateway";

export class FakeGateway implements PaymentGateway {
  constructor(private readonly _ipn: VerifiedPaymentIpn) {}

  async createPaymentUrl(_request: PaymentRequest): Promise<string> {
    throw new Error("NOT_IMPLEMENTED");
  }

  verifyIpn(_params: URLSearchParams): VerifiedPaymentIpn {
    throw new Error("NOT_IMPLEMENTED");
  }
}
