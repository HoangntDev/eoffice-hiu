import type { PaymentGateway, VerifiedPaymentIpn } from "./gateway";

export type IpnResponse = { RspCode: string; Message: string };
export type IpnRecorder = (ipn: VerifiedPaymentIpn) => Promise<IpnResponse>;

export async function processPaymentIpn(
  _gateway: PaymentGateway,
  _params: URLSearchParams,
  _record: IpnRecorder,
): Promise<IpnResponse> {
  throw new Error("NOT_IMPLEMENTED");
}
