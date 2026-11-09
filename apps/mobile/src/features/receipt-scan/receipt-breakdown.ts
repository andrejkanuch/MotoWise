/**
 * How a receipt's parts / labor / tax relate to its total. The breakdown is
 * optional detail — it never blocks a save. Mirrors the server's reconcile gate
 * in `receipt-scan.service.ts` (parts + labor + tax <= total, 0.001 slack): a
 * breakdown the server would drop is resolved here first, so what the rider
 * sees is what gets saved.
 */
import { RECEIPT_REVIEW_TYPE, type ReceiptReviewType } from './scan-flow-constants';

const RECONCILE_EPSILON = 0.001;
/**
 * How close parts + labor must be to the total to read as "tax already in the
 * prices". Below the total, half a percent (at least 2 cents) covers per-line
 * VAT rounding without matching unrelated numbers, and nothing is changed.
 */
const TAX_INCLUDED_RELATIVE_TOLERANCE = 0.005;
/**
 * Above the total, only rounding cents are accepted — that excess is the one
 * thing the clamp takes off, so it may never be more than a rider would read as
 * rounding. A bigger excess is a real mismatch and goes to OVER_TOTAL, where the
 * rider sees the warning instead of a silently changed number.
 */
const TAX_INCLUDED_MAX_EXCESS = 0.02;

export const BREAKDOWN_STATUS = {
  /** Nothing to reconcile: no positive total, or no breakdown entered. */
  NONE: 'none',
  /** parts + labor + tax fit within the total. Saved as entered. */
  FITS: 'fits',
  /**
   * parts + labor already equal the total, so the printed tax is part of those
   * prices (common on EU receipts, where lines show VAT-inclusive prices and
   * the VAT is repeated at the bottom). Saved without the tax line.
   */
  TAX_INCLUDED: 'tax_included',
  /** Over the total and not explained by included tax. Saved as the total only. */
  OVER_TOTAL: 'over_total',
} as const;
export type BreakdownStatus = (typeof BREAKDOWN_STATUS)[keyof typeof BREAKDOWN_STATUS];

interface BreakdownInput {
  total: number | null;
  parts: number | null;
  labor: number | null;
  tax: number | null;
}

export interface BreakdownReconciliation {
  status: BreakdownStatus;
  /** parts + labor + tax, rounded to cents (0 when none was entered). */
  sum: number;
  /** What to send to the server — always a breakdown the server keeps. */
  saved: { parts: number | null; labor: number | null; tax: number | null };
}

const roundCents = (n: number) => Math.round(n * 100) / 100;

export function reconcileBreakdown({
  total,
  parts,
  labor,
  tax,
}: BreakdownInput): BreakdownReconciliation {
  const entered = { parts, labor, tax };
  const sum = roundCents((parts ?? 0) + (labor ?? 0) + (tax ?? 0));
  if (total == null || total <= 0 || sum === 0) {
    return { status: BREAKDOWN_STATUS.NONE, sum, saved: entered };
  }
  if (sum <= total + RECONCILE_EPSILON) {
    return { status: BREAKDOWN_STATUS.FITS, sum, saved: entered };
  }

  const gross = roundCents((parts ?? 0) + (labor ?? 0));
  const excess = roundCents(gross - total);
  const underTolerance = Math.max(TAX_INCLUDED_MAX_EXCESS, total * TAX_INCLUDED_RELATIVE_TOLERANCE);
  const grossMatchesTotal =
    excess > 0 ? excess <= TAX_INCLUDED_MAX_EXCESS : -excess <= underTolerance;
  if ((tax ?? 0) > 0 && gross > 0 && grossMatchesTotal) {
    // Parts and labor are saved as printed (tax included), with no separate
    // tax line. The server gate is strict, so a gross sum a cent or two over
    // the total loses that rounding excess from the larger component.
    const takeFromParts = (parts ?? 0) >= (labor ?? 0);
    return {
      status: BREAKDOWN_STATUS.TAX_INCLUDED,
      sum,
      saved: {
        parts: parts != null && takeFromParts ? roundCents(parts - Math.max(0, excess)) : parts,
        labor: labor != null && !takeFromParts ? roundCents(labor - Math.max(0, excess)) : labor,
        tax: null,
      },
    };
  }

  return {
    status: BREAKDOWN_STATUS.OVER_TOTAL,
    sum,
    saved: { parts: null, labor: null, tax: null },
  };
}

/** The money-breakdown fields of the save payload. */
export interface BreakdownPayloadFields {
  partsCost: number | null;
  laborCost: number | null;
  taxAmount: number | null;
  taxRate: number | null;
}

/**
 * What the review card sends for parts / labor / tax. A breakdown belongs to a
 * maintenance record only: an expense save sends none of it, whatever is still
 * typed into the (hidden) maintenance fields after a type switch. For
 * maintenance it sends the reconciled values, never the raw field text.
 */
export function breakdownPayloadFields(
  type: ReceiptReviewType,
  breakdown: BreakdownReconciliation,
  printedTaxRate: number | null,
): BreakdownPayloadFields {
  if (type !== RECEIPT_REVIEW_TYPE.MAINTENANCE) {
    return { partsCost: null, laborCost: null, taxAmount: null, taxRate: null };
  }
  return {
    partsCost: breakdown.saved.parts,
    laborCost: breakdown.saved.labor,
    taxAmount: breakdown.saved.tax,
    // taxRate is printed metadata — carried straight through from extraction.
    taxRate: printedTaxRate,
  };
}
