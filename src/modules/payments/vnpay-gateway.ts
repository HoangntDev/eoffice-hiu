import { createHmac, timingSafeEqual } from "node:crypto";
import type { IpnPaymentGateway, PaymentRequest, VerifiedPaymentIpn } from "./gateway";

export type VnpayConfig = {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
  returnUrl: string;
};

function vnpayUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

function canonicalParams(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key, value]) => key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && value !== "")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${vnpayUrlencode(key)}=${vnpayUrlencode(value)}`)
    .join("&");
}

export function signVnpayParams(params: URLSearchParams, secret: string): string {
  return createHmac("sha512", secret).update(canonicalParams(params), "utf8").digest("hex");
}

function sameHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{128}$/i.test(left) || !/^[0-9a-f]{128}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function vnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

function parseVnpayDate(value: string | null): Date | null {
  if (!value || !/^\d{14}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class VnpayGateway implements IpnPaymentGateway {
  constructor(private readonly config: VnpayConfig) {}

  async createPaymentUrl(request: PaymentRequest): Promise<string> {
    const params = new URLSearchParams({
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: String(request.amountVnd * 100),
      vnp_CurrCode: "VND",
      vnp_TxnRef: request.orderRef,
      vnp_OrderInfo: request.orderInfo,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: request.ipAddress,
      vnp_CreateDate: vnpayDate(request.createdAt),
      vnp_ExpireDate: vnpayDate(new Date(request.createdAt.getTime() + 15 * 60_000)),
    });
    const hash = signVnpayParams(params, this.config.hashSecret);
    const query = canonicalParams(params);
    return `${this.config.paymentUrl}?${query}&vnp_SecureHash=${hash}`;
  }

  verifyIpn(params: URLSearchParams): VerifiedPaymentIpn {
    const receivedHash = params.get("vnp_SecureHash") ?? "";
    const expectedHash = signVnpayParams(params, this.config.hashSecret);
    const rawAmount = Number(params.get("vnp_Amount"));
    const amountVnd = Number.isSafeInteger(rawAmount) && rawAmount >= 0 && rawAmount % 100 === 0
      ? rawAmount / 100
      : Number.NaN;
    return {
      signatureValid: params.get("vnp_TmnCode") === this.config.tmnCode
        && sameHex(receivedHash, expectedHash),
      orderRef: params.get("vnp_TxnRef") ?? "",
      amountVnd,
      transactionRef: params.get("vnp_TransactionNo") ?? "",
      responseCode: params.get("vnp_ResponseCode") ?? "99",
      transactionStatus: params.get("vnp_TransactionStatus") ?? "99",
      paidAt: parseVnpayDate(params.get("vnp_PayDate")),
    };
  }
}
