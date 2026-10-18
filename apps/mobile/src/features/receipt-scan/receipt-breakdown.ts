/**
 * Mirrors the server's reconcile gate in `receipt-scan.service.ts` (parts + labor
 * + tax <= total, with the same 0.001 slack). Kept exact on purpose: when the
 * breakdown is over the total, the API saves the total alone and drops the
 * breakdown, so the review card blocks Save and tells the rider why instead.
 */
const RECONCILE_EPSILON = 0.001;

interface BreakdownInput {
  total: number | null;
  parts: number | null;
  labor: number | null;
  tax: number | null;
}

/** The parts + labor + tax sum when it exceeds the total, rounded to cents; null when it fits. */
export function breakdownOverTotal({ total, parts, labor, tax }: BreakdownInput): number | null {
  if (total == null || total <= 0) return null;
  const sum = (parts ?? 0) + (labor ?? 0) + (tax ?? 0);
  return sum > total + RECONCILE_EPSILON ? Math.round(sum * 100) / 100 : null;
}
