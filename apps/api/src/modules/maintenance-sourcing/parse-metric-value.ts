/**
 * Metric value parse helper for the maintenance-sourcing extraction (plan U2 / KTD 8).
 *
 * The CRF1100 owner's manual (English edition `31MKS800`) formats decimals with a point
 * (`0.20 mm`, `4.8 L`) and uses the comma as a thousands separator (`10,000 km`). The dataset
 * stores a single canonical metric value as a JS number (`value_numeric`) parsed ONCE here,
 * while the verbatim manual string is kept separately as `value_display`. Parsing once at
 * extraction (not at render) is deliberate: a locale-format reparse at render time can produce
 * a wrong-by-orders-of-magnitude value (KTD 8 — `value TEXT` was rejected for exactly this reason).
 */

/**
 * Parse a number written in English convention (dot decimal, comma thousands) into a JS number.
 * Strips a trailing unit suffix so `'0.20 mm'` / `'4.8 L'` / `'24 Nm'` all parse to their value.
 *
 * Examples:
 *   parseMetricValue('0.20')      -> 0.2
 *   parseMetricValue('0.20 mm')   -> 0.2
 *   parseMetricValue('4.8 L')     -> 4.8
 *   parseMetricValue('10,000 km') -> 10000   (comma = thousands grouping)
 *   parseMetricValue('1,250.5')   -> 1250.5
 *   parseMetricValue('24 Nm')     -> 24
 *
 * @throws Error when no numeric token can be extracted (caller treats as a failed extraction).
 */
export function parseMetricValue(raw: string): number {
  if (typeof raw !== 'string') {
    throw new TypeError(`parseMetricValue expected a string, received ${typeof raw}`);
  }

  const trimmed = raw.trim();

  // Reject a value RANGE (e.g. '0.20-0.24 mm', '0.20–0.24'): a digit, a dash, then another digit.
  // A range must be split by the caller, never silently collapsed to its lower bound (which would
  // narrow a safety-critical clearance/torque spec). Forces a failed extraction instead.
  if (/\d\s*[-–—]\s*\d/.test(trimmed)) {
    throw new Error(`parseMetricValue: "${raw}" looks like a range; split it before parsing`);
  }

  // Isolate the leading numeric token (digits, separators, optional sign), dropping the unit.
  const match = trimmed.match(/^[+-]?[\d., \s]*\d/);
  if (!match) {
    throw new Error(`parseMetricValue: no numeric token found in "${raw}"`);
  }

  // Strip whitespace / non-breaking-space thousands separators.
  let token = match[0].replace(/[\s ]/g, '');

  // A comma is only a thousands separator in English when it groups exactly 3 digits. Reject an
  // ambiguous comma (e.g. '1,2') rather than silently treating it as 12 — a 10x safety error.
  if (token.includes(',') && !/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(token)) {
    throw new Error(`parseMetricValue: ambiguous comma in "${raw}" (not a thousands group)`);
  }

  // Commas validated as thousands grouping — strip them; the dot is the decimal mark.
  token = token.replace(/,/g, '');

  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new Error(`parseMetricValue: "${raw}" did not resolve to a finite number`);
  }
  return value;
}
