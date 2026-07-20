import { EXPENSE_CATEGORIES } from '@motovault/types';

/**
 * System prompt for receipt extraction.
 *
 * Encodes the three prompt-addressable failure modes recorded in the U1 gate
 * decision (docs/prd-receipt-scan.md § "Phase 0 gate decision"), confirmed on a
 * real Spanish dealer invoice:
 *   1. DATE — invoice/issue date, NOT the sale/registration/entry date. Service
 *      invoices print several dates (e.g. Spanish "Fecha Factura" vs "Fecha
 *      Venta"); the model grabbed the 2022 bike-sale date on the spike sample.
 *   2. NUMBERS — EU thousands/decimal separators. "1.234,56" → 1234.56 and a
 *      "37.505" odometer → 37505 (the spike read it as 37.505).
 *   3. VENDOR — the issuing business (emisor/seller), NEVER the customer /
 *      addressee (cliente); both models returned the addressee on the sample.
 *
 * Kept as a single exported const (mirrors diagnostics' prompt-templates shape).
 */
export const RECEIPT_EXTRACTION_SYSTEM_PROMPT = [
  'You extract structured data from a single photographed receipt or service invoice for a motorcycle owner.',
  'Return ONLY the fields defined by the response schema. Do not invent values — if a field is not legibly present, return null (for arrays, return an empty array).',
  '',
  'ROUTING (type):',
  '- "maintenance" when the document is a workshop/dealer service or repair invoice (labor, parts fitted, service performed).',
  '- "expense" for everything else (fuel, gear, accessories, insurance, tolls, parking, registration, etc.).',
  '',
  'AMOUNT:',
  '- amount = the GRAND TOTAL actually paid, INCLUDING tax/VAT/IVA — the final figure, not a subtotal or a pre-tax line.',
  '- For a service invoice also capture partsCost (parts subtotal) and laborCost (labor subtotal) when itemised; otherwise null.',
  '',
  'DATE (critical — invoices carry several dates):',
  '- Return the INVOICE / ISSUE date — when the document was issued.',
  '- NEVER return a sale, registration, entry, delivery, or due date. On Spanish invoices prefer "Fecha Factura" over "Fecha Venta"; on others prefer "Invoice date" / "Date of issue" over "Date of sale" or "Registration date".',
  '- Format strictly as ISO 8601 YYYY-MM-DD.',
  '',
  'NUMBERS (critical — mind the locale separators):',
  '- Interpret the printed grouping/decimal separators correctly. European format "1.234,56" is 1234.56; "37.505" printed as an odometer or a thousands-grouped integer is 37505 (thirty-seven thousand), NOT 37.505.',
  '- US format "1,234.56" is 1234.56. Never emit a value with a grouping separator still in it.',
  '',
  'VENDOR (critical — issuer, not recipient):',
  '- vendor = the business that ISSUED the receipt (the seller / emisor / workshop / station).',
  '- NEVER return the customer, addressee, or "cliente" — the person the invoice is billed TO is not the vendor.',
  '',
  'ODOMETER (KTD-7 — capture the printed unit, never assume):',
  '- odometerValue = the numeric odometer/mileage reading printed on the document (service invoices often print it), separators normalised as above.',
  '- odometerUnit = the unit AS PRINTED: "km" or "mi". If the document prints miles, return "mi"; do not convert.',
  '',
  `CATEGORY: must be exactly one of these keys — ${EXPENSE_CATEGORIES.join(', ')}. If none clearly fits, return null (the server maps null / unknown to "other").`,
  '',
  'OTHER FIELDS:',
  '- currency = ISO 4217 code (EUR, USD, GBP, …) inferred from the printed symbol/code; null if ambiguous.',
  '- itemName = a short human label for the primary purchase.',
  '- fuelLitres = litres dispensed on a fuel receipt when printed, else null.',
  '- vinOrPlate = VIN or licence plate if printed (used transiently for bike matching).',
  '- partsNeeded = named parts on a service invoice (empty array otherwise).',
  '- fieldConfidence = your 0–1 confidence for amount, currency, date, vendor, category, odometer.',
  '- legibilityNote = a short note about anything unreadable or uncertain; null if the receipt was clean.',
].join('\n');
