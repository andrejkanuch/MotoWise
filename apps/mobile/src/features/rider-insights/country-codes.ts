/**
 * ISO 3166-1 alpha-2 codes to the international vehicle registration letters a
 * rider sees on an oval country sticker (E for Spain, A for Austria, USA for the
 * United States). Europe and the Americas, the markets the app serves. A code
 * missing here shows as its ISO letters, so a new country never renders blank.
 */
const PLATE_LETTERS: Readonly<Record<string, string>> = {
  // Europe
  AD: 'AND',
  AL: 'AL',
  AT: 'A',
  BA: 'BIH',
  BE: 'B',
  BG: 'BG',
  BY: 'BY',
  CH: 'CH',
  CY: 'CY',
  CZ: 'CZ',
  DE: 'D',
  DK: 'DK',
  EE: 'EST',
  ES: 'E',
  FI: 'FIN',
  FR: 'F',
  GB: 'UK',
  GI: 'GBZ',
  GR: 'GR',
  HR: 'HR',
  HU: 'H',
  IE: 'IRL',
  IS: 'IS',
  IT: 'I',
  LI: 'FL',
  LT: 'LT',
  LU: 'L',
  LV: 'LV',
  MC: 'MC',
  MD: 'MD',
  ME: 'MNE',
  MK: 'NMK',
  MT: 'M',
  NL: 'NL',
  NO: 'N',
  PL: 'PL',
  PT: 'P',
  RO: 'RO',
  RS: 'SRB',
  SE: 'S',
  SI: 'SLO',
  SK: 'SK',
  SM: 'RSM',
  TR: 'TR',
  UA: 'UA',
  VA: 'V',
  XK: 'RKS',
  // Americas
  AR: 'RA',
  BO: 'BOL',
  BR: 'BR',
  BZ: 'BZ',
  CA: 'CDN',
  CL: 'RCH',
  CO: 'CO',
  CR: 'CR',
  CU: 'C',
  DO: 'DOM',
  EC: 'EC',
  GT: 'GCA',
  HN: 'HN',
  JM: 'JA',
  MX: 'MEX',
  NI: 'NIC',
  PA: 'PA',
  PE: 'PE',
  PR: 'PR',
  PY: 'PY',
  SV: 'ES',
  US: 'USA',
  UY: 'ROU',
  VE: 'YV',
  // Elsewhere riders often cross into
  MA: 'MA',
};

/** The plate letters for an ISO alpha-2 code: `ES` -> `E`, `US` -> `USA`. */
export function plateLettersFor(isoA2: string): string {
  const code = isoA2.toUpperCase();
  return PLATE_LETTERS[code] ?? code;
}
