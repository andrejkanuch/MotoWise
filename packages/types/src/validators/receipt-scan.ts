/**
 * Receipt-scan extraction schema (SHIPPED, versioned).
 *
 * The vision model (GPT-4.1 via `zodResponseFormat`) fills this contract from a
 * single receipt image. It is the shipped counterpart of the U1 spike schema
 * (`scripts/receipt-scan-spike/schema.ts`) — same shape, but this is the source
 * of truth for the API extraction service and the mobile review card.
 *
 * OpenAI structured outputs run in STRICT mode: every property must be present
 * in the object, so "optional" fields are modelled as `.nullable()` rather than
 * `.optional()`. Bump RECEIPT_SCAN_SCHEMA_VERSION whenever this contract changes
 * so persisted `extraction_payload` rows can be migrated / interpreted by version.
 *
 * KTD-7: the odometer is captured as `odometerValue` + `odometerUnit` (the
 * *printed* unit), never assumed km — a US/UK receipt prints miles.
 * KTD-9: `vinOrPlate` is a transient bike-match datum; the service strips it
 * before persisting the payload — it is intentionally part of the extraction
 * contract (the model returns it) but never stored.
 */
import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '../constants/expense-categories';

/** Bumped when the extraction contract changes. Persisted alongside payloads. */
export const RECEIPT_SCAN_SCHEMA_VERSION = 1 as const;

/** Routing signal returned by the model. */
export const RECEIPT_SCAN_TYPES = ['maintenance', 'expense'] as const;
export type ReceiptScanType = (typeof RECEIPT_SCAN_TYPES)[number];

/** Odometer unit as *printed* on the receipt (KTD-7). Never assumed. */
export const ODOMETER_UNITS = ['km', 'mi'] as const;
export type OdometerUnit = (typeof ODOMETER_UNITS)[number];

const OdometerUnitSchema = z.enum(ODOMETER_UNITS);

/**
 * Per-field self-reported confidence (0–1). Drives the review card's
 * needs-check (amber) state downstream (G5 — ≥90% ≤2 corrections).
 */
export const ReceiptFieldConfidenceSchema = z.object({
  amount: z.number(),
  currency: z.number(),
  date: z.number(),
  vendor: z.number(),
  category: z.number(),
  odometer: z.number(),
});
export type ReceiptFieldConfidence = z.infer<typeof ReceiptFieldConfidenceSchema>;

export const ReceiptExtractionSchema = z.object({
  /** Routing signal: service/repair invoice → maintenance; everything else → expense. */
  type: z.enum(RECEIPT_SCAN_TYPES),
  /** Grand total actually paid, incl. tax. Null when unreadable. */
  amount: z.number().nullable(),
  /** ISO 4217 code (EUR, USD, GBP, …). Null when not printed / ambiguous. */
  currency: z.string().nullable(),
  /** Invoice/issue date, ISO 8601 (YYYY-MM-DD). Null when unreadable. */
  date: z.string().nullable(),
  /** Issuing business (seller/emisor), NEVER the customer/addressee. */
  vendor: z.string().nullable(),
  itemName: z.string().nullable(),
  /** Constrained to the exact EXPENSE_CATEGORIES enum; out-of-enum → 'other' downstream. */
  category: z.enum(EXPENSE_CATEGORIES).nullable(),
  /** Maintenance only: parts subtotal. */
  partsCost: z.number().nullable(),
  /** Maintenance only: labor subtotal. */
  laborCost: z.number().nullable(),
  /** KTD-7: numeric odometer reading as printed (EU-separator normalised). */
  odometerValue: z.number().nullable(),
  /** KTD-7: the printed unit of `odometerValue` — never assumed. */
  odometerUnit: OdometerUnitSchema.nullable(),
  /** Fuel receipts: litres dispensed, when printed. */
  fuelLitres: z.number().nullable(),
  /** KTD-9: transient bike-match datum; stripped before persist by the service. */
  vinOrPlate: z.string().nullable(),
  /** Maintenance only: parts named on the invoice. */
  partsNeeded: z.array(z.string()),
  fieldConfidence: ReceiptFieldConfidenceSchema,
  /** Free-text note on legibility / anything the model was unsure about. */
  legibilityNote: z.string().nullable(),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

/**
 * Runtime contract for the `saveReceiptScan` mutation input (U7b / KTD-11).
 *
 * GraphQL `@InputType()` decorators and TS types do NOT validate runtime values,
 * so this schema is applied at the resolver boundary (via ZodValidationPipe) to
 * keep malformed amounts, dates, categories, odometer data, and record types out
 * of the expense/maintenance write path. Mirrors `SaveReceiptScanInput` in the
 * API DTO; kept permissive where the review card legitimately allows free text.
 */
/**
 * A single reviewed service line item (maintenance save path). `serviceType` is
 * the canonical MaintenanceServiceType key; the server re-derives it from
 * `label` when absent/unknown, so the client may omit it. Cost fields are
 * optional itemization detail — the task's total remains authoritative.
 */
export const SaveReceiptScanLineItemSchema = z.object({
  serviceType: z.string().max(64).nullable().optional(),
  label: z.string().min(1).max(300),
  partRef: z.string().max(120).nullable().optional(),
  quantity: z.number().nonnegative().nullable().optional(),
  unitPrice: z.number().nonnegative().nullable().optional(),
  lineTotal: z.number().nonnegative().nullable().optional(),
});
export type SaveReceiptScanLineItem = z.infer<typeof SaveReceiptScanLineItemSchema>;

export const SaveReceiptScanInputSchema = z.object({
  motorcycleId: z.string().uuid(),
  /** 'maintenance' | 'expense' — dispatches the write path. */
  type: z.enum(RECEIPT_SCAN_TYPES),
  amount: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(1).max(8).nullable().optional(),
  /** Any parseable calendar/ISO date; the service falls back to today when null. */
  date: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date')
    .nullable()
    .optional(),
  vendor: z.string().max(300).nullable().optional(),
  itemName: z.string().max(300).nullable().optional(),
  category: z.string().max(64).nullable().optional(),
  partsCost: z.number().nonnegative().nullable().optional(),
  laborCost: z.number().nonnegative().nullable().optional(),
  /** Explicit tax/VAT on the visit (maintenance). Kept separate from parts/labor (NET). */
  taxAmount: z.number().nonnegative().nullable().optional(),
  /** Printed tax rate as a percentage (e.g. 21 for 21% IVA). */
  taxRate: z.number().nonnegative().nullable().optional(),
  /** Reviewed service line items (maintenance). Persisted as maintenance_task_line_items. */
  lineItems: z.array(SaveReceiptScanLineItemSchema).max(50).optional(),
  applyOdometer: z.boolean().optional(),
  odometerValue: z.number().nonnegative().nullable().optional(),
  /** 'km' | 'mi' as PRINTED on the receipt — never assumed (KTD-7). */
  odometerUnit: OdometerUnitSchema.nullable().optional(),
});
export type SaveReceiptScanInput = z.infer<typeof SaveReceiptScanInputSchema>;
