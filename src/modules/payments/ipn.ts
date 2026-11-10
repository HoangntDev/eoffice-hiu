import type { PaymentGateway, VerifiedPaymentIpn } from "./gateway";

export type IpnResponse = { RspCode: string; Message: string };
export type IpnRecorder = (ipn: VerifiedPaymentIpn) => Promise<IpnResponse>;

export async function processPaymentIpn(
  gateway: PaymentGateway,
  params: URLSearchParams,
  record: IpnRecorder,
): Promise<IpnResponse> {
  try {
    const ipn = gateway.verifyIpn(params);
    if (!ipn.signatureValid) return { RspCode: "97", Message: "Invalid signature" };
    return await record(ipn);
  } catch {
    return { RspCode: "99", Message: "Unknown error" };
  }
}
