import { createUnionType, Field, Float, ObjectType } from '@nestjs/graphql';

/**
 * Per-field self-reported confidence (0–1). Mirrors ReceiptFieldConfidenceSchema.
 * Drives the review card's needs-check (amber) state.
 */
@ObjectType()
export class ReceiptFieldConfidenceResult {
  @Field(() => Float)
  amount: number;

  @Field(() => Float)
  currency: number;

  @Field(() => Float)
  date: number;

  @Field(() => Float)
  vendor: number;

  @Field(() => Float)
  category: number;

  @Field(() => Float)
  odometer: number;
}

/**
 * Extraction result surfaced to the client. Mirrors the ReceiptExtractionSchema
 * Zod contract MINUS `vinOrPlate` (KTD-9 — stripped server-side, never leaves
 * the API). `category` is always one of the EXPENSE_CATEGORIES enum values (the
 * service coerces out-of-enum → 'other').
 */
@ObjectType()
export class ReceiptExtractionResult {
  /** 'maintenance' | 'expense' */
  @Field()
  type: string;

  @Field(() => Float, { nullable: true })
  amount?: number | null;

  @Field(() => String, { nullable: true })
  currency?: string | null;

  @Field(() => String, { nullable: true })
  date?: string | null;

  @Field(() => String, { nullable: true })
  vendor?: string | null;

  @Field(() => String, { nullable: true })
  itemName?: string | null;

  @Field(() => String, { nullable: true })
  category?: string | null;

  @Field(() => Float, { nullable: true })
  partsCost?: number | null;

  @Field(() => Float, { nullable: true })
  laborCost?: number | null;

  /** KTD-7: printed odometer reading. */
  @Field(() => Float, { nullable: true })
  odometerValue?: number | null;

  /** KTD-7: printed odometer unit ('km' | 'mi'). */
  @Field(() => String, { nullable: true })
  odometerUnit?: string | null;

  @Field(() => Float, { nullable: true })
  fuelLitres?: number | null;

  @Field(() => [String])
  partsNeeded: string[];

  @Field(() => ReceiptFieldConfidenceResult)
  fieldConfidence: ReceiptFieldConfidenceResult;

  @Field(() => String, { nullable: true })
  legibilityNote?: string | null;

  /**
   * Server-flagged fields the client should force into needs-check regardless of
   * confidence (e.g. an out-of-enum category coerced to 'other').
   */
  @Field(() => [String])
  needsCheck: string[];
}

@ObjectType()
export class ReceiptScanSuccess {
  /** The reservation/scan id (receipt_scans.id) — used for save/cancel/resume. */
  @Field()
  scanId: string;

  @Field(() => ReceiptExtractionResult)
  result: ReceiptExtractionResult;
}

@ObjectType()
export class ReceiptScanError {
  /** One of RECEIPT_SCAN_ERROR_CODES. */
  @Field()
  code: string;

  @Field()
  reason: string;
}

export const ReceiptScanResult = createUnionType({
  name: 'ReceiptScanResult',
  types: () => [ReceiptScanSuccess, ReceiptScanError] as const,
  resolveType(value) {
    if ('result' in value) return ReceiptScanSuccess;
    return ReceiptScanError;
  },
});
