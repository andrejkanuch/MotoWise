/**
 * Decimal-comma parse helper for the maintenance-sourcing extraction (plan U2 / KTD 8).
 *
 * The CRF1100 owner's manual is the Spanish edition, which formats decimals with a comma
 * (`0,20 mm`, `4,8 L`). The dataset stores a single canonical metric value as a JS number
 * (`value_numeric`, dot-decimal) parsed ONCE here, while the verbatim manual string is kept
 * separately as `value_display`. Parsing once at extraction (not at render) is deliberate:
 * a locale-format reparse at render time can produce a 100x-wrong torque on a decimal-comma
 * slip (KTD 8 — `value TEXT` was rejected for exactly this reason).
 */

/**
 * Parse a number written with European decimal-comma (and optional thousands separators)
 * into a JS number. Strips a trailing unit suffix so `'0,20 mm'` / `'4,8 L'` / `'24 Nm'`
 * all parse to their numeric value.
 *
 * Examples:
 *   parseMetricValue('0,20')      -> 0.2
 *   parseMetricValue('0,20 mm')   -> 0.2
 *   parseMetricValue('4,8 L')     -> 4.8
 *   parseMetricValue('1.250,5')   -> 1250.5   (es thousands grouping)
 *   parseMetricValue('24 Nm')     -> 24
 *   parseMetricValue('0.20')      -> 0.2      (already dot-decimal, tolerated)
 *
 * @throws Error when no numeric token can be extracted (caller treats as a failed extraction).
 */
export function parseMetricValue(raw: string): number {
  if (typeof raw !== 'string') {
    throw new TypeError(`parseMetricValue expected a string, received ${typeof raw}`);
  }

  // Isolate the leading numeric token (digits, separators, optional sign), dropping the unit.
  const match = raw.trim().match(/^[+-]?[\d., \s]*\d/);
  if (!match) {
    throw new Error(`parseMetricValue: no numeric token found in "${raw}"`);
  }

  // Remove whitespace / non-breaking-space thousands separators.
  let token = match[0].replace(/[\s ]/g, '');

  const hasComma = token.includes(',');
  const hasDot = token.includes('.');

  if (hasComma && hasDot) {
    // Mixed separators: the LAST separator is the decimal mark, the other is grouping.
    // es-edition: '1.250,5' -> dot grouping, comma decimal.
    if (token.lastIndexOf(',') > token.lastIndexOf('.')) {
      token = token.replace(/\./g, '').replace(',', '.');
    } else {
      token = token.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Comma is the decimal mark (the manual's native format).
    token = token.replace(',', '.');
  }
  // hasDot-only is already dot-decimal — leave as-is.

  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new Error(`parseMetricValue: "${raw}" did not resolve to a finite number`);
  }
  return value;
}
