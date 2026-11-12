import { describe, expect, it, vi } from "vitest";
import { FakeGateway } from "@/modules/payments/fake-gateway";
import type { PaymentRequest, VerifiedPaymentIpn } from "@/modules/payments/gateway";
import { processPaypalCapture } from "@/modules/payments/paypal";
import { PaypalGateway } from "@/modules/payments/paypal-gateway";
import { resolvePaymentProvider } from "@/modules/payments/provider";

const request: PaymentRequest = {
  orderRef: "UF2026PAYPAL01",
  amountVnd: 60_000,
  orderInfo: "Doan phi nam 2026",
  ipAddress: "203.0.113.10",
  createdAt: new Date("2026-11-12T20:00:00+07:00"),
};

const unusedIpn: VerifiedPaymentIpn = {
  signatureValid: true,
  orderRef: request.orderRef,
  amountVnd: request.amountVnd,
  transactionRef: "unused",
  responseCode: "00",
  transactionStatus: "00",
  paidAt: null,
};

const paypalOrder = {
  providerOrderId: "5O190127TN364715T",
  approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
  amountUsd: "2.40",
  currency: "USD",
};

const completedCapture = {
  providerOrderId: paypalOrder.providerOrderId,
  captureId: "3C679366HH908993F",
  status: "COMPLETED",
  customId: request.orderRef,
  amountUsd: paypalOrder.amountUsd,
  currency: paypalOrder.currency,
  paidAt: new Date("2026-11-12T13:10:00.000Z"),
};

describe("PayPal sandbox qua PaymentGateway", () => {
  it("FakeGateway mô phỏng trọn luồng tạo order và capture PayPal", async () => {
    const gateway = new FakeGateway(unusedIpn, { order: paypalOrder, capture: completedCapture });
    await expect(gateway.createPaypalOrder(request)).resolves.toEqual(paypalOrder);
    const record = vi.fn().mockResolvedValue({ RspCode: "00", Message: "Confirm Success" });
    await expect(processPaypalCapture(gateway, paypalOrder.providerOrderId, {
      orderRef: request.orderRef,
      amountUsd: paypalOrder.amountUsd,
      currency: "USD",
    }, record)).resolves.toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith(completedCapture);
  });

  it("không ghi database khi capture chưa COMPLETED", async () => {
    const gateway = new FakeGateway(unusedIpn, {
      order: paypalOrder,
      capture: { ...completedCapture, status: "PENDING" },
    });
    const record = vi.fn();
    await expect(processPaypalCapture(gateway, paypalOrder.providerOrderId, {
      orderRef: request.orderRef, amountUsd: "2.40", currency: "USD",
    }, record)).resolves.toMatchObject({ RspCode: "99" });
    expect(record).not.toHaveBeenCalled();
  });

  it.each([
    [{ amountUsd: "2.41" }, "amount"],
    [{ currency: "EUR" }, "currency"],
    [{ customId: "UF2026OTHER" }, "custom_id"],
  ])("không ghi database khi %s lệch", async (change) => {
    const gateway = new FakeGateway(unusedIpn, {
      order: paypalOrder,
      capture: { ...completedCapture, ...change },
    });
    const record = vi.fn();
    await expect(processPaypalCapture(gateway, paypalOrder.providerOrderId, {
      orderRef: request.orderRef, amountUsd: "2.40", currency: "USD",
    }, record)).resolves.toMatchObject({ RspCode: "04" });
    expect(record).not.toHaveBeenCalled();
  });

  it("capture lặp lại nhận kết quả idempotent và không tạo bản ghi thứ hai", async () => {
    const gateway = new FakeGateway(unusedIpn, { order: paypalOrder, capture: completedCapture });
    let recorded = false;
    const record = vi.fn().mockImplementation(async () => {
      if (recorded) return { RspCode: "02", Message: "Order already confirmed" };
      recorded = true;
      return { RspCode: "00", Message: "Confirm Success" };
    });
    const expected = { orderRef: request.orderRef, amountUsd: "2.40", currency: "USD" };
    await expect(processPaypalCapture(gateway, paypalOrder.providerOrderId, expected, record))
      .resolves.toMatchObject({ RspCode: "00" });
    await expect(processPaypalCapture(gateway, paypalOrder.providerOrderId, expected, record))
      .resolves.toMatchObject({ RspCode: "02" });
  });

  it("đổi 60.000 VND sang 2.40 USD và gửi custom_id khi tạo Orders API v2", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: paypalOrder.providerOrderId,
        status: "CREATED",
        links: [{ rel: "approve", href: paypalOrder.approvalUrl }],
      }), { status: 201 }));
    const gateway = new PaypalGateway({
      clientId: "unit-client-id",
      clientSecret: "unit-client-secret",
      apiUrl: "https://api-m.sandbox.paypal.com",
      returnUrl: "http://127.0.0.1:3000/api/payments/paypal/return",
      cancelUrl: "http://127.0.0.1:3000/api/payments/paypal/cancel",
      vndPerUsd: 25_000,
    }, fetchMock);

    await expect(gateway.createPaypalOrder(request)).resolves.toEqual(paypalOrder);
    const createCall = fetchMock.mock.calls[1];
    const body = JSON.parse(String((createCall[1] as RequestInit).body));
    expect(body.purchase_units[0]).toMatchObject({
      custom_id: request.orderRef,
      amount: { currency_code: "USD", value: "2.40" },
    });
  });
});

describe("chọn cổng thanh toán", () => {
  it("mặc định dùng VNPay và nhận PayPal", () => {
    expect(resolvePaymentProvider(undefined)).toBe("vnpay");
    expect(resolvePaymentProvider("paypal")).toBe("paypal");
  });

  it("từ chối PAYMENT_PROVIDER ngoài vnpay|paypal", () => {
    expect(() => resolvePaymentProvider("stripe")).toThrow("INVALID_PAYMENT_PROVIDER");
  });
});
