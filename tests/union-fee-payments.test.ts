import { describe, expect, it, vi } from "vitest";
import { formatLogLine } from "@/lib/log";
import { buildUnionFeeCsv } from "@/modules/payments/csv";
import { FakeGateway } from "@/modules/payments/fake-gateway";
import { parseMonthlyAmount, yearlyAmount } from "@/modules/payments/fee";
import type { PaymentRequest, VerifiedPaymentIpn } from "@/modules/payments/gateway";
import { processPaymentIpn } from "@/modules/payments/ipn";
import { signVnpayParams, VnpayGateway } from "@/modules/payments/vnpay-gateway";

const request: PaymentRequest = {
  orderRef: "UF2026ABC123",
  amountVnd: 60_000,
  orderInfo: "Doan phi nam 2026",
  ipAddress: "203.0.113.10",
  createdAt: new Date("2026-11-11T00:00:00+07:00"),
};

const validIpn: VerifiedPaymentIpn = {
  signatureValid: true,
  orderRef: request.orderRef,
  amountVnd: request.amountVnd,
  transactionRef: "15000001",
  responseCode: "00",
  transactionStatus: "00",
  paidAt: new Date("2026-11-11T00:05:00+07:00"),
};

describe("mức Đoàn phí Trung ương", () => {
  it.each([2_000, 5_000, 10_000, 20_000])("nhận mức %i đồng/tháng", (amount) => {
    expect(parseMonthlyAmount(amount)).toBe(amount);
  });

  it.each([0, 3_000, 15_000, 20_001, "5000"])("từ chối mức không hợp lệ %s", (amount) => {
    expect(() => parseMonthlyAmount(amount)).toThrow("INVALID_MONTHLY_AMOUNT");
  });

  it.each([
    [2_000, 24_000],
    [5_000, 60_000],
    [10_000, 120_000],
    [20_000, 240_000],
  ] as const)("tính %i × 12 = %i trong miền nghiệp vụ", (monthly, total) => {
    expect(yearlyAmount(monthly)).toBe(total);
  });
});

describe("PaymentGateway và IPN", () => {
  it("FakeGateway tạo URL có mã đơn và số tiền để unit test không gọi dịch vụ ngoài", async () => {
    const gateway = new FakeGateway(validIpn);
    const url = new URL(await gateway.createPaymentUrl(request));
    expect(url.origin).toBe("https://fake-gateway.test");
    expect(url.searchParams.get("orderRef")).toBe(request.orderRef);
    expect(url.searchParams.get("amount")).toBe(String(request.amountVnd));
  });

  it("chữ ký sai trả 97 và tuyệt đối không ghi database", async () => {
    const gateway = new FakeGateway({ ...validIpn, signatureValid: false });
    const record = vi.fn();
    await expect(processPaymentIpn(gateway, new URLSearchParams(), record)).resolves.toEqual({
      RspCode: "97",
      Message: "Invalid signature",
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("IPN hợp lệ chuyển đúng dữ liệu đã chuẩn hóa sang database", async () => {
    const gateway = new FakeGateway(validIpn);
    const record = vi.fn().mockResolvedValue({ RspCode: "00", Message: "Confirm Success" });
    await expect(processPaymentIpn(gateway, new URLSearchParams(), record)).resolves.toEqual({
      RspCode: "00",
      Message: "Confirm Success",
    });
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith(validIpn);
  });

  it("VnpayGateway phát hiện HMAC-SHA512 bị sửa", () => {
    const secret = "unit-test-secret-only";
    const params = new URLSearchParams({
      vnp_Amount: "6000000",
      vnp_ResponseCode: "00",
      vnp_TransactionNo: "15000001",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: request.orderRef,
      vnp_PayDate: "20261111000500",
    });
    params.set("vnp_SecureHash", signVnpayParams(params, secret));
    params.set("vnp_Amount", "12000000");
    const gateway = new VnpayGateway({
      tmnCode: "TESTCODE",
      hashSecret: secret,
      paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      returnUrl: "http://127.0.0.1:3000/payments/return",
    });
    expect(gateway.verifyIpn(params).signatureValid).toBe(false);
  });

  it("VnpayGateway từ chối payload ký đúng nhưng thiếu mã merchant", () => {
    const secret = "unit-test-secret-only";
    const params = new URLSearchParams({
      vnp_Amount: "6000000",
      vnp_ResponseCode: "00",
      vnp_TransactionNo: "15000001",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: request.orderRef,
      vnp_PayDate: "20261111000500",
    });
    params.set("vnp_SecureHash", signVnpayParams(params, secret));
    const gateway = new VnpayGateway({
      tmnCode: "TESTCODE",
      hashSecret: secret,
      paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      returnUrl: "http://127.0.0.1:3000/payments/return",
    });
    expect(gateway.verifyIpn(params).signatureValid).toBe(false);
  });
});

describe("đối chiếu và log an toàn", () => {
  it("CSV có đủ 12 cột tháng và escape dữ liệu có dấu phẩy", () => {
    const csv = buildUnionFeeCsv([{
      studentCode: "9990000001",
      fullName: "Nguyễn Văn A, lớp trưởng",
      classCode: "99TEST1",
      monthlyAmount: 5_000,
      paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      paidAt: "2026-11-11T00:05:00+07:00",
      transactionRef: "15000001",
    }]);
    expect(csv.split("\n")[0]).toBe("MSSV,Họ tên,Lớp,Mức/tháng,Tháng 1,Tháng 2,Tháng 3,Tháng 4,Tháng 5,Tháng 6,Tháng 7,Tháng 8,Tháng 9,Tháng 10,Tháng 11,Tháng 12,Ngày đóng,Mã giao dịch");
    expect(csv).toContain('"Nguyễn Văn A, lớp trưởng"');
    expect(csv).toContain(",Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,Đã đóng,");
  });

  it("log che MSSV và loại bỏ chữ ký, secret", () => {
    const line = formatLogLine("info", "payment.ipn", {
      studentCode: "9990000001",
      orderRef: request.orderRef,
      transactionRef: validIpn.transactionRef,
      signatureValid: false,
      vnp_SecureHash: "must-not-appear",
      signature: "must-not-appear-either",
      hashSecret: "must-not-appear-secret",
      amountVnd: request.amountVnd,
    });
    expect(line).toContain("999***01");
    expect(line).toContain(request.orderRef);
    expect(line).toContain(validIpn.transactionRef);
    expect(line).toContain('"signatureValid":false');
    expect(line).not.toContain("must-not-appear");
  });
});
