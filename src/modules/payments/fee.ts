export const UNION_FEE_MONTHLY_AMOUNTS = [2_000, 5_000, 10_000, 20_000] as const;
export type UnionFeeMonthlyAmount = (typeof UNION_FEE_MONTHLY_AMOUNTS)[number];

export function parseMonthlyAmount(_value: unknown): UnionFeeMonthlyAmount {
  throw new Error("NOT_IMPLEMENTED");
}

export function yearlyAmount(_monthlyAmount: UnionFeeMonthlyAmount): number {
  throw new Error("NOT_IMPLEMENTED");
}
