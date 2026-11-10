export const UNION_FEE_MONTHLY_AMOUNTS = [2_000, 5_000, 10_000, 20_000] as const;
export type UnionFeeMonthlyAmount = (typeof UNION_FEE_MONTHLY_AMOUNTS)[number];

export function parseMonthlyAmount(value: unknown): UnionFeeMonthlyAmount {
  if (typeof value !== "number" || !UNION_FEE_MONTHLY_AMOUNTS.includes(value as UnionFeeMonthlyAmount)) {
    throw new Error("INVALID_MONTHLY_AMOUNT");
  }
  return value as UnionFeeMonthlyAmount;
}

export function yearlyAmount(monthlyAmount: UnionFeeMonthlyAmount): number {
  return monthlyAmount * 12;
}
