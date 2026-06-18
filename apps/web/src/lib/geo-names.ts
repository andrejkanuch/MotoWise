/**
 * Human-readable display names for country and region codes used in route URLs.
 * Codes are stored lowercase in URLs (e.g. /route/us/ca/…) and uppercase in DB.
 */

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  DE: 'Germany',
  AT: 'Austria',
  CH: 'Switzerland',
  IT: 'Italy',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  PT: 'Portugal',
  GR: 'Greece',
  HR: 'Croatia',
  NO: 'Norway',
  SE: 'Sweden',
  RO: 'Romania',
  CZ: 'Czech Republic',
  SK: 'Slovakia',
  SI: 'Slovenia',
  BA: 'Bosnia and Herzegovina',
  ME: 'Montenegro',
  AL: 'Albania',
  MK: 'North Macedonia',
  BG: 'Bulgaria',
  RS: 'Serbia',
  PL: 'Poland',
  BR: 'Brazil',
  AR: 'Argentina',
  MX: 'Mexico',
  CO: 'Colombia',
  CL: 'Chile',
  CA: 'Canada',
  VN: 'Vietnam',
  TH: 'Thailand',
  ID: 'Indonesia',
  MY: 'Malaysia',
  PH: 'Philippines',
  IN: 'India',
  NP: 'Nepal',
  JP: 'Japan',
  KR: 'South Korea',
  TW: 'Taiwan',
  NZ: 'New Zealand',
  AU: 'Australia',
  ZA: 'South Africa',
  MA: 'Morocco',
  TR: 'Turkey',
  GE: 'Georgia',
  AM: 'Armenia',
};

/** US state abbreviation → full name */
const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

/** German Bundesländer */
const DE_REGIONS: Record<string, string> = {
  BY: 'Bavaria',
  BW: 'Baden-Württemberg',
  NW: 'North Rhine-Westphalia',
  NI: 'Lower Saxony',
  HE: 'Hesse',
  SN: 'Saxony',
  RP: 'Rhineland-Palatinate',
  TH: 'Thuringia',
  SH: 'Schleswig-Holstein',
  ST: 'Saxony-Anhalt',
  MV: 'Mecklenburg-Vorpommern',
  BB: 'Brandenburg',
  SL: 'Saarland',
  BE: 'Berlin',
  HH: 'Hamburg',
  HB: 'Bremen',
};

/** Austrian Bundesländer */
const AT_REGIONS: Record<string, string> = {
  T: 'Tyrol',
  SBG: 'Salzburg',
  K: 'Carinthia',
  ST: 'Styria',
  OO: 'Upper Austria',
  V: 'Vorarlberg',
  NO: 'Lower Austria',
  B: 'Burgenland',
  W: 'Vienna',
};

/** Canadian provinces & territories (ISO 3166-2:CA). */
const CA_REGIONS: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

/** Italian regions — codes as stored on trips (3-letter abbreviations). */
const IT_REGIONS: Record<string, string> = {
  LOM: 'Lombardy',
  TAA: 'Trentino-Alto Adige',
  TOS: 'Tuscany',
  PIE: 'Piedmont',
  VEN: 'Veneto',
  LIG: 'Liguria',
  LAZ: 'Lazio',
  CAM: 'Campania',
  SIC: 'Sicily',
  SAR: 'Sardinia',
  PUG: 'Apulia',
  EMR: 'Emilia-Romagna',
  ABR: 'Abruzzo',
  UMB: 'Umbria',
  MAR: 'Marche',
  CAL: 'Calabria',
  FVG: 'Friuli-Venezia Giulia',
  VDA: 'Aosta Valley',
  MOL: 'Molise',
  BAS: 'Basilicata',
};

/** Country → region code → region name */
const REGION_NAMES: Record<string, Record<string, string>> = {
  US: US_STATES,
  DE: DE_REGIONS,
  AT: AT_REGIONS,
  CA: CA_REGIONS,
  IT: IT_REGIONS,
};

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve a country URL slug (e.g. "us") to a display name (e.g. "United States") */
export function countryDisplayName(slug: string): string {
  return COUNTRY_NAMES[slug.toUpperCase()] ?? titleCase(slug);
}

/**
 * Resolve a region URL slug to a display name within a country
 * (e.g. ("us", "ca") → "California"). Args are (country, region) to read in URL
 * order; falls back to a title-cased slug for regions we don't have a name map
 * for (every caller already passed this order — the previous (region, country)
 * signature silently mis-resolved every region name).
 */
export function regionDisplayName(countrySlug: string, regionSlug: string): string {
  const regionMap = REGION_NAMES[countrySlug.toUpperCase()];
  const name = regionMap?.[regionSlug.toUpperCase()];
  return name ?? titleCase(regionSlug);
}
