import type {
  PaymentRequest,
  PaypalCapture,
  PaypalOrder,
  PaypalPaymentGateway,
} from "./gateway";

export type PaypalConfig = {
  clientId: string;
  clientSecret: string;
  apiUrl: string;
  returnUrl: string;
  cancelUrl: string;
  vndPerUsd: number;
};

type Fetch = typeof fetch;
const REQUEST_TIMEOUT_MS = 5_000;

type PaypalLink = { rel?: string; href?: string };
type PaypalAmount = { currency_code?: string; value?: string };
type PaypalCapturePayload = {
  id?: string;
  status?: string;
  amount?: PaypalAmount;
  create_time?: string;
};
type PaypalPurchaseUnit = {
  custom_id?: string;
  amount?: PaypalAmount;
  payments?: { captures?: PaypalCapturePayload[] };
};

export class PaypalGateway implements PaypalPaymentGateway {
  constructor(
    private readonly config: PaypalConfig,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    if (!Number.isFinite(config.vndPerUsd) || config.vndPerUsd <= 0) {
      throw new Error("INVALID_PAYPAL_VND_PER_USD");
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(`${this.config.apiUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async accessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`, "utf8").toString("base64");
    const response = await this.request("/v1/oauth2/token", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new Error(`PAYPAL_OAUTH_FAILED:${response.status}`);
    const body = await response.json() as { access_token?: string };
    if (!body.access_token) throw new Error("PAYPAL_OAUTH_INVALID_RESPONSE");
    return body.access_token;
  }

  private amountUsd(amountVnd: number): string {
    return (amountVnd / this.config.vndPerUsd).toFixed(2);
  }

  async createPaypalOrder(request: PaymentRequest): Promise<PaypalOrder> {
    const token = await this.accessToken();
    const amountUsd = this.amountUsd(request.amountVnd);
    const response = await this.request("/v2/checkout/orders", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "paypal-request-id": `create-${request.orderRef}`,
        prefer: "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: request.orderRef,
          description: request.orderInfo,
          amount: { currency_code: "USD", value: amountUsd },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: this.config.returnUrl,
              cancel_url: this.config.cancelUrl,
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`PAYPAL_CREATE_ORDER_FAILED:${response.status}`);
    const body = await response.json() as { id?: string; links?: PaypalLink[] };
    const approvalUrl = body.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
    if (!body.id || !approvalUrl) throw new Error("PAYPAL_CREATE_ORDER_INVALID_RESPONSE");
    return { providerOrderId: body.id, approvalUrl, amountUsd, currency: "USD" };
  }

  async createPaymentUrl(request: PaymentRequest): Promise<string> {
    return (await this.createPaypalOrder(request)).approvalUrl;
  }

  async captureOrder(providerOrderId: string): Promise<PaypalCapture> {
    const token = await this.accessToken();
    const response = await this.request(`/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "paypal-request-id": `capture-${providerOrderId}`,
        prefer: "return=representation",
      },
      body: "{}",
    });
    if (!response.ok) throw new Error(`PAYPAL_CAPTURE_FAILED:${response.status}`);
    const body = await response.json() as {
      id?: string;
      status?: string;
      purchase_units?: PaypalPurchaseUnit[];
    };
    const purchaseUnit = body.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    if (!body.id) throw new Error("PAYPAL_CAPTURE_INVALID_RESPONSE");
    const paidAt = capture?.create_time ? new Date(capture.create_time) : null;
    return {
      providerOrderId: body.id,
      captureId: capture?.id ?? "",
      status: capture?.status ?? body.status ?? "",
      customId: purchaseUnit?.custom_id ?? "",
      amountUsd: capture?.amount?.value ?? purchaseUnit?.amount?.value ?? "",
      currency: capture?.amount?.currency_code ?? purchaseUnit?.amount?.currency_code ?? "",
      paidAt: paidAt && !Number.isNaN(paidAt.valueOf()) ? paidAt : null,
    };
  }
}
