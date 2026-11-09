import { describe, expect, it } from '@jest/globals';
import { BREAKDOWN_STATUS, breakdownPayloadFields, reconcileBreakdown } from '../receipt-breakdown';
import { RECEIPT_REVIEW_TYPE } from '../scan-flow-constants';

describe('reconcileBreakdown', () => {
  it('keeps a breakdown that fits the total as entered', () => {
    const r = reconcileBreakdown({ total: 105.05, parts: 60, labor: 40, tax: 5.05 });
    expect(r.status).toBe(BREAKDOWN_STATUS.FITS);
    expect(r.saved).toEqual({ parts: 60, labor: 40, tax: 5.05 });
    expect(reconcileBreakdown({ total: 120, parts: 60, labor: null, tax: null }).status).toBe(
      BREAKDOWN_STATUS.FITS,
    );
  });

  it('ignores floating-point noise below the server slack', () => {
    expect(reconcileBreakdown({ total: 0.3, parts: 0.1, labor: 0.2, tax: null }).status).toBe(
      BREAKDOWN_STATUS.FITS,
    );
  });

  it('reads VAT-inclusive line prices as tax included and drops the repeated tax', () => {
    // The tyre-fitting receipt: lines at gross prices, IVA 21% repeated below.
    const r = reconcileBreakdown({ total: 104.42, parts: 84.42, labor: 20, tax: 18.12 });
    expect(r.status).toBe(BREAKDOWN_STATUS.TAX_INCLUDED);
    expect(r.saved).toEqual({ parts: 84.42, labor: 20, tax: null });
  });

  it('clamps a gross sum a few cents over the total so the server keeps it', () => {
    const r = reconcileBreakdown({ total: 100, parts: 70.02, labor: 30, tax: 17.36 });
    expect(r.status).toBe(BREAKDOWN_STATUS.TAX_INCLUDED);
    expect(r.saved).toEqual({ parts: 70, labor: 30, tax: null });
    const saved = (r.saved.parts ?? 0) + (r.saved.labor ?? 0);
    expect(saved).toBeLessThanOrEqual(100);
  });

  it('takes a rounding excess off labor when labor is the larger part', () => {
    const r = reconcileBreakdown({ total: 100, parts: 30, labor: 70.02, tax: 17 });
    expect(r.status).toBe(BREAKDOWN_STATUS.TAX_INCLUDED);
    expect(r.saved).toEqual({ parts: 30, labor: 70, tax: null });
  });

  it('never changes a number by more than rounding cents', () => {
    // Gross 1005 on a 1000 receipt: 5 over is a real mismatch, not rounding.
    // It must surface as OVER_TOTAL (warning + "Keep total only"), not save
    // parts as 900 while the field still shows 905.
    const r = reconcileBreakdown({ total: 1000, parts: 905, labor: 100, tax: 174 });
    expect(r.status).toBe(BREAKDOWN_STATUS.OVER_TOTAL);
    expect(r.saved).toEqual({ parts: null, labor: null, tax: null });
    // 3 cents over is past the rounding allowance.
    expect(reconcileBreakdown({ total: 100, parts: 70.03, labor: 30, tax: 17 }).status).toBe(
      BREAKDOWN_STATUS.OVER_TOTAL,
    );
  });

  it('keeps gross prices just under the total unchanged', () => {
    // Half a percent under (per-line VAT rounding) still reads as tax included,
    // and nothing is clamped because nothing is over.
    const r = reconcileBreakdown({ total: 1000, parts: 896, labor: 100, tax: 173.6 });
    expect(r.status).toBe(BREAKDOWN_STATUS.TAX_INCLUDED);
    expect(r.saved).toEqual({ parts: 896, labor: 100, tax: null });
    // Further under than that is not a tax-included receipt.
    expect(reconcileBreakdown({ total: 1000, parts: 890, labor: 100, tax: 174 }).status).toBe(
      BREAKDOWN_STATUS.OVER_TOTAL,
    );
  });

  it('is not tax included without a tax line, even when parts + labor exceed the total', () => {
    expect(reconcileBreakdown({ total: 100, parts: 80, labor: 20.02, tax: null }).status).toBe(
      BREAKDOWN_STATUS.OVER_TOTAL,
    );
  });

  it('saves the total only when the breakdown is over and tax does not explain it', () => {
    const r = reconcileBreakdown({ total: 105, parts: 60, labor: 40, tax: 5.05 });
    expect(r.status).toBe(BREAKDOWN_STATUS.OVER_TOTAL);
    expect(r.sum).toBe(105.05);
    expect(r.saved).toEqual({ parts: null, labor: null, tax: null });
    // parts + labor well over the total — not a tax-included receipt.
    expect(reconcileBreakdown({ total: 50, parts: 80, labor: 20, tax: 10 }).status).toBe(
      BREAKDOWN_STATUS.OVER_TOTAL,
    );
  });

  it('has nothing to reconcile without a positive total or a breakdown', () => {
    expect(reconcileBreakdown({ total: null, parts: 10, labor: 5, tax: 1 }).status).toBe(
      BREAKDOWN_STATUS.NONE,
    );
    expect(reconcileBreakdown({ total: 0, parts: 10, labor: 5, tax: 1 }).status).toBe(
      BREAKDOWN_STATUS.NONE,
    );
    expect(reconcileBreakdown({ total: 50, parts: null, labor: null, tax: null }).status).toBe(
      BREAKDOWN_STATUS.NONE,
    );
  });
});

describe('breakdownPayloadFields', () => {
  it('sends the reconciled split for maintenance, never the raw field values', () => {
    const taxIncluded = reconcileBreakdown({ total: 104.42, parts: 84.42, labor: 20, tax: 18.12 });
    expect(breakdownPayloadFields(RECEIPT_REVIEW_TYPE.MAINTENANCE, taxIncluded, 21)).toEqual({
      partsCost: 84.42,
      laborCost: 20,
      taxAmount: null,
      taxRate: 21,
    });
    const over = reconcileBreakdown({ total: 105, parts: 60, labor: 40, tax: 5.05 });
    expect(breakdownPayloadFields(RECEIPT_REVIEW_TYPE.MAINTENANCE, over, 21)).toEqual({
      partsCost: null,
      laborCost: null,
      taxAmount: null,
      taxRate: 21,
    });
  });

  it('sends no breakdown for an expense, even with maintenance fields still filled in', () => {
    const fits = reconcileBreakdown({ total: 105.05, parts: 60, labor: 40, tax: 5.05 });
    expect(breakdownPayloadFields(RECEIPT_REVIEW_TYPE.EXPENSE, fits, 21)).toEqual({
      partsCost: null,
      laborCost: null,
      taxAmount: null,
      taxRate: null,
    });
  });
});
