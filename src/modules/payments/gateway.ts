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
  verifyIpn(params: URLSearchParams): VerifiedPaymentIpn;
}
