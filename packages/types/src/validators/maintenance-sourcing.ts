import { z } from 'zod';

// Maintenance data-sourcing pilot — validation schemas (U2 extraction, U3 approve).
// Keep value literals in sync with the DB CHECKs in migration 00149 and with
// MaintenanceSpecType / MaintenanceSourceType in ../constants/enums.

// --- Physical-range guards (injection hardening, U2 / plan KTD 8) -----------
// Out-of-range extracted numbers fail before insert. Ranges are deliberately wide;
// the human verification gate is the precision backstop, this only rejects fabrications.
export const INTERVAL_KM_RANGE = { min: 500, max: 100_000 } as const;
export const INTERVAL_DAYS_RANGE = { min: 1, max: 3650 } as const;

// Per spec_type plausible metric ranges (in the canonical metric unit noted).
export const SPEC_VALUE_RANGES = {
  torque: { min: 1, max: 500 }, // Nm
  valve_clearance: { min: 0.01, max: 2 }, // mm
  capacity: { min: 0.01, max: 30 }, // L
  pressure: { min: 0.3, max: 6 }, // bar
  plug_gap: { min: 0.1, max: 2 }, // mm
} as const;

// --- Extraction draft output (the LLM/parser produces these; numbers ARE expected here,
//     unlike the narrative path which forbids them) ----------------------------
export const ExtractedScheduleDraftSchema = z.object({
  taskName: z.string().min(1),
  description: z.string().optional(),
  intervalKm: z.number().int().min(INTERVAL_KM_RANGE.min).max(INTERVAL_KM_RANGE.max).optional(),
  intervalDays: z
    .number()
    .int()
    .min(INTERVAL_DAYS_RANGE.min)
    .max(INTERVAL_DAYS_RANGE.max)
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  sourcePage: z.string().min(1),
  sourceContext: z.string().optional(),
});
export type ExtractedScheduleDraft = z.infer<typeof ExtractedScheduleDraftSchema>;

export const ExtractedSpecDraftSchema = z.object({
  specType: z.enum(['torque', 'valve_clearance', 'capacity', 'pressure', 'plug_gap']),
  specName: z.string().min(1),
  // Canonical metric value (dot-decimal). Decimal-comma is normalized BEFORE validation.
  valueNumeric: z.number().positive(),
  // Verbatim manual string the human verifies against (e.g. '0,20 mm').
  valueDisplay: z.string().optional(),
  unit: z.string().min(1),
  sourcePage: z.string().min(1),
  sourceContext: z.string().optional(),
});
export type ExtractedSpecDraft = z.infer<typeof ExtractedSpecDraftSchema>;

/** Refine a spec draft against its per-spec_type physical range. */
export function isSpecValueInRange(draft: ExtractedSpecDraft): boolean {
  const range = SPEC_VALUE_RANGES[draft.specType];
  return draft.valueNumeric >= range.min && draft.valueNumeric <= range.max;
}

// --- Admin approve input (U3) -----------------------------------------------
// One draft table per row; the mutation approves a single id (bulk non-critical = N calls).
export const MaintenanceDraftKind = { SCHEDULE: 'schedule', SPEC: 'spec' } as const;
export type MaintenanceDraftKind =
  (typeof MaintenanceDraftKind)[keyof typeof MaintenanceDraftKind];

export const ApproveMaintenanceDraftInputSchema = z.object({
  kind: z.enum(['schedule', 'spec']),
  id: z.string().uuid(),
});
export type ApproveMaintenanceDraftInput = z.infer<typeof ApproveMaintenanceDraftInputSchema>;
