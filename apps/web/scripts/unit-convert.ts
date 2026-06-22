/**
 * Pure metric→imperial conversion + per-spec_type rounding for the maintenance
 * data pilot (U5 / KTD 7).
 *
 * Canonical values are stored in the manual's native METRIC units. Imperial is
 * DERIVED here and never persisted to the dataset DB rows. On the web article it
 * is baked into the committed MDX at generation time (static MDX has no
 * per-request render hook); on mobile the same math runs at render time.
 *
 * Rounding is a SAFETY concern (KTD 7): the derived imperial value isn't separately
 * verified (it's a deterministic conversion of the verified metric), and naive rounding can mint a practically
 * wrong value (24 Nm → 17.7 → 18 lb-ft is a ~5% over-torque; valve clearance
 * must keep thousandths-of-an-inch precision). So rounding precision is defined
 * PER spec_type, and a `convert → round → convert-back` tolerance check flags any
 * spec whose round-tripped value drifts beyond a stated per-type tolerance — that
 * spec's DISPLAYED imperial needs human review before it ships.
 *
 * Only a type-only import (erased at runtime) — kept otherwise self-contained so it is
 * trivially unit-testable and a standalone `tsx` script can import it.
 */

// Spec types that carry a per-spec_type rounding rule — the shared union from @motovault/types
// (distance is handled separately because interval rows are not specs).
import type { MaintenanceSpecType } from '@motovault/types';

export interface ImperialResult {
  /** Converted + rounded imperial magnitude. */
  value: number;
  /** Imperial unit label for display. */
  unit: string;
  /**
   * True when `convert(round(value))` back to metric stays within the
   * per-spec_type tolerance of the original metric value. When false, the
   * displayed imperial drifted from the canonical metric and needs human review.
   */
  withinTolerance: boolean;
}

// --- Raw conversion factors (metric → imperial), no rounding ----------------
const NM_PER_LBFT = 1.355_817_948;
const MM_PER_INCH = 25.4;
const KPA_PER_PSI = 6.894_757_293;
const L_PER_QUART_US = 0.946_352_946;
const KM_PER_MILE = 1.609_344;

/** Round `n` to `decimals` decimal places (half-up, sign-safe). */
function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Round `n` to `sig` significant figures (used for thousandths-of-an-inch clearance). */
function roundSigFigs(n: number, sig: number): number {
  if (n === 0) return 0;
  const mag = Math.ceil(Math.log10(Math.abs(n)));
  const power = sig - mag;
  const f = 10 ** power;
  return Math.round(n * f) / f;
}

/**
 * Per-spec_type conversion rule: how to convert metric→imperial, how to round
 * the imperial display, how to convert imperial back to metric (for the
 * round-trip check), the imperial unit label, and the tolerance the round-trip
 * must stay within (expressed in canonical metric units).
 */
interface SpecRule {
  toImperial: (metric: number) => number;
  round: (imperial: number) => number;
  backToMetric: (imperial: number) => number;
  unit: string;
  /** Absolute tolerance in the metric unit. */
  metricTolerance: number;
}

const SPEC_RULES: Record<MaintenanceSpecType, SpecRule> = {
  // Torque: 1 decimal lb-ft. Tight tolerance — over-torque is a fastener risk.
  torque: {
    toImperial: (nm) => nm / NM_PER_LBFT,
    round: (lbft) => roundTo(lbft, 1),
    backToMetric: (lbft) => lbft * NM_PER_LBFT,
    unit: 'lb-ft',
    metricTolerance: 0.5, // Nm
  },
  // Valve clearance: thousandths of an inch / 3 sig figs. Precision-critical.
  valve_clearance: {
    toImperial: (mm) => mm / MM_PER_INCH,
    round: (inch) => roundSigFigs(inch, 3),
    backToMetric: (inch) => inch * MM_PER_INCH,
    unit: 'in',
    metricTolerance: 0.01, // mm
  },
  // Capacity: 1 decimal US quarts.
  capacity: {
    toImperial: (l) => l / L_PER_QUART_US,
    round: (qt) => roundTo(qt, 1),
    backToMetric: (qt) => qt * L_PER_QUART_US,
    unit: 'qt',
    metricTolerance: 0.1, // L
  },
  // Pressure: whole psi.
  pressure: {
    toImperial: (kpa) => kpa / KPA_PER_PSI,
    round: (psi) => Math.round(psi),
    backToMetric: (psi) => psi * KPA_PER_PSI,
    unit: 'psi',
    metricTolerance: 5, // kPa (~0.7 psi)
  },
  // Plug gap: thousandths of an inch / 3 sig figs (same as clearance).
  plug_gap: {
    toImperial: (mm) => mm / MM_PER_INCH,
    round: (inch) => roundSigFigs(inch, 3),
    backToMetric: (inch) => inch * MM_PER_INCH,
    unit: 'in',
    metricTolerance: 0.02, // mm
  },
};

/**
 * Convert a metric spec value to its rounded imperial display, with the
 * round-trip tolerance check. Pure.
 */
export function convertSpecToImperial(
  specType: MaintenanceSpecType,
  metric: number,
): ImperialResult {
  const rule = SPEC_RULES[specType];
  const rounded = rule.round(rule.toImperial(metric));
  const roundTripMetric = rule.backToMetric(rounded);
  const withinTolerance = Math.abs(roundTripMetric - metric) <= rule.metricTolerance;
  return { value: rounded, unit: rule.unit, withinTolerance };
}

/**
 * Convert a metric interval distance (km) to whole miles for display. Interval
 * rows are not specs, so they get their own helper. Whole-mile rounding matches
 * the existing maintenance articles ("8,000 mi (12,000 km)").
 */
export function convertKmToMiles(km: number): number {
  return Math.round(km / KM_PER_MILE);
}
