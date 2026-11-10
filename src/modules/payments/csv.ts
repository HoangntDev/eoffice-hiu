export type UnionFeeCsvRow = {
  studentCode: string;
  fullName: string;
  classCode: string;
  monthlyAmount: number;
  paidMonths: number[];
  paidAt: string | null;
  transactionRef: string | null;
};

export function buildUnionFeeCsv(_rows: UnionFeeCsvRow[]): string {
  throw new Error("NOT_IMPLEMENTED");
}
