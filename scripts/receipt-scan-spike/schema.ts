/**
 * Draft R1 receipt-extraction schema for the U1 spike (THROWAWAY).
 *
 * This is the shakeout schema referenced by PRD R1 + KTD-7. It is NOT the
 * shipped validator — that lives in `packages/types/src/validators/receipt-scan.ts`
 * (U2/U4). This copy exists only so the spike can drive the vision model via
 * `zodResponseFormat` and see how the model fills each field.
 *
 * KTD-7: the odometer is captured as `odometerValue` + `odometerUnit` (the
 * *printed* unit), never assumed km — a US/UK receipt prints miles.
 *
 * OpenAI structured outputs run in strict mode: every property must be present
 * in the object, so "optional" fields are modelled as `.nullable()` rather than
 * `.optional()`.
 */
import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '../../packages/types/src/constants/expense-categories';

/** Bumped when the extraction contract changes; mirrors the shipped schema's versioning intent. */
export const RECEIPT_SCAN_SCHEMA_VERSION = 1 as const;

export const ODOMETER_UNITS = ['km', 'mi'] as const;
const OdometerUnitSchema = z.enum(ODOMETER_UNITS);

/** Per-field self-reported confidence (0–1). Drives the review card's needs-check state downstream. */
const FieldConfidenceSchema = z.object({
  amount: z.number(),
  currency: z.number(),
  date: z.number(),
  vendor: z.number(),
  category: z.number(),
  odometer: z.number(),
});

export const ReceiptExtractionSchema = z.object({
  /** Routing signal: service/repair invoice → maintenance; everything else → expense. */
  type: z.enum(['maintenance', 'expense']),
  /** Grand total actually paid. Null when unreadable. */
  amount: z.number().nullable(),
  /** ISO 4217 code (EUR, USD, GBP, …). Null when not printed / ambiguous. */
  currency: z.string().nullable(),
  /** ISO 8601 date (YYYY-MM-DD). Null when unreadable. */
  date: z.string().nullable(),
  vendor: z.string().nullable(),
  itemName: z.string().nullable(),
  /** Constrained to the exact 14-value EXPENSE_CATEGORIES enum; out-of-enum → other downstream. */
  category: z.enum(EXPENSE_CATEGORIES).nullable(),
  /** Maintenance only: parts subtotal. */
  partsCost: z.number().nullable(),
  /** Maintenance only: labor subtotal. */
  laborCost: z.number().nullable(),
  /** KTD-7: numeric odometer reading as printed. */
  odometerValue: z.number().nullable(),
  /** KTD-7: the printed unit of `odometerValue` — never assumed. */
  odometerUnit: OdometerUnitSchema.nullable(),
  /** Fuel receipts: litres dispensed, when printed. */
  fuelLitres: z.number().nullable(),
  /** Transient bike-match datum; stripped before persist in the shipped service (KTD-9). */
  vinOrPlate: z.string().nullable(),
  /** Maintenance only: parts named on the invoice. */
  partsNeeded: z.array(z.string()),
  fieldConfidence: FieldConfidenceSchema,
  /** Free-text note on legibility / anything the model was unsure about. */
  legibilityNote: z.string().nullable(),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

/**
 * Fields scored for the U1 gate. `usable` (see run.ts) is derived from the
 * money-bearing core: amount, currency, date, vendor, category, type.
 */
export const SCORED_FIELDS = [
  'type',
  'amount',
  'currency',
  'date',
  'vendor',
  'itemName',
  'category',
  'odometerValue',
  'odometerUnit',
  'fuelLitres',
] as const;

export type ScoredField = (typeof SCORED_FIELDS)[number];
