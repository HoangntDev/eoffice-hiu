export type PaymentRequest = {
  orderRef: string;
  amountVnd: number;
  orderInfo: string;
  ipAddress: string;
  createdAt: Date;
};

export type VerifiedPaymentIpn = {
  signatureValid: boolean;
  orderRef: string;
  amountVnd: number;
  transactionRef: string;
  responseCode: string;
  transactionStatus: string;
  paidAt: Date | null;
};

export interface PaymentGateway {
  createPaymentUrl(request: PaymentRequest): Promise<string>;
}

export interface IpnPaymentGateway extends PaymentGateway {
  verifyIpn(params: URLSearchParams): VerifiedPaymentIpn;
}

export type PaypalOrder = {
  providerOrderId: string;
  approvalUrl: string;
  amountUsd: string;
  currency: "USD";
};

export type PaypalCapture = {
  providerOrderId: string;
  captureId: string;
  status: string;
  customId: string;
  amountUsd: string;
  currency: string;
  paidAt: Date | null;
};

export interface PaypalPaymentGateway extends PaymentGateway {
  createPaypalOrder(request: PaymentRequest): Promise<PaypalOrder>;
  captureOrder(providerOrderId: string): Promise<PaypalCapture>;
}
