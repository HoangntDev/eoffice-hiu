import type { PaymentGateway, PaymentRequest, VerifiedPaymentIpn } from "./gateway";

export class FakeGateway implements PaymentGateway {
  constructor(private readonly ipn: VerifiedPaymentIpn) {}

  async createPaymentUrl(request: PaymentRequest): Promise<string> {
    const url = new URL("https://fake-gateway.test/pay");
    url.searchParams.set("orderRef", request.orderRef);
    url.searchParams.set("amount", String(request.amountVnd));
    return url.toString();
  }

  verifyIpn(_params: URLSearchParams): VerifiedPaymentIpn {
    return this.ipn;
  }
}
