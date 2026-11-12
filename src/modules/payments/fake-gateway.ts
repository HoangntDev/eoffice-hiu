import type {
  IpnPaymentGateway,
  PaymentRequest,
  PaypalCapture,
  PaypalOrder,
  PaypalPaymentGateway,
  VerifiedPaymentIpn,
} from "./gateway";

type PaypalFixtures = { order: PaypalOrder; capture: PaypalCapture };

export class FakeGateway implements IpnPaymentGateway, PaypalPaymentGateway {
  constructor(
    private readonly ipn: VerifiedPaymentIpn,
    private readonly paypal?: PaypalFixtures,
  ) {}

  async createPaymentUrl(request: PaymentRequest): Promise<string> {
    const url = new URL("https://fake-gateway.test/pay");
    url.searchParams.set("orderRef", request.orderRef);
    url.searchParams.set("amount", String(request.amountVnd));
    return url.toString();
  }

  verifyIpn(): VerifiedPaymentIpn {
    return this.ipn;
  }

  async createPaypalOrder(request: PaymentRequest): Promise<PaypalOrder> {
    void request;
    if (!this.paypal) throw new Error("PAYPAL_FIXTURE_MISSING");
    return this.paypal.order;
  }

  async captureOrder(): Promise<PaypalCapture> {
    if (!this.paypal) throw new Error("PAYPAL_FIXTURE_MISSING");
    return this.paypal.capture;
  }
}
