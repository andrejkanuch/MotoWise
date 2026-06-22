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

  // Isolate the leading numeric token (digits, separators, optional sign), dropping the unit.
  const match = raw.trim().match(/^[+-]?[\d., \s]*\d/);
  if (!match) {
    throw new Error(`parseMetricValue: no numeric token found in "${raw}"`);
  }

  // Strip whitespace / non-breaking-space, then commas (English thousands grouping). The dot is
  // the decimal mark and is left intact.
  const token = match[0].replace(/[\s ]/g, '').replace(/,/g, '');

  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new Error(`parseMetricValue: "${raw}" did not resolve to a finite number`);
  }
  return value;
}
