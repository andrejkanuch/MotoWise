/**
 * Supported countries for route discovery browsing.
 * Shared between mobile and web apps.
 * Must match countries in the `places` table with route_count > 0.
 */
export const SUPPORTED_COUNTRY_CODES = [
  'AR',
  'AT',
  'AU',
  'BG',
  'BO',
  'CA',
  'CH',
  'CL',
  'DE',
  'ES',
  'FR',
  'GB',
  'GR',
  'HR',
  'IE',
  'IN',
  'IS',
  'IT',
  'JP',
  'MA',
  'ME',
  'MX',
  'NO',
  'PT',
  'RO',
  'SI',
  'SK',
  'TR',
  'US',
  'VN',
] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export function isSupportedCountry(code: string | undefined): code is SupportedCountryCode {
  return code != null && (SUPPORTED_COUNTRY_CODES as ReadonlyArray<string>).includes(code);
}

export const COUNTRY_NAMES: Record<SupportedCountryCode, string> = {
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  BG: 'Bulgaria',
  BO: 'Bolivia',
  CA: 'Canada',
  CH: 'Switzerland',
  CL: 'Chile',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  HR: 'Croatia',
  IE: 'Ireland',
  IN: 'India',
  IS: 'Iceland',
  IT: 'Italy',
  JP: 'Japan',
  MA: 'Morocco',
  ME: 'Montenegro',
  MX: 'Mexico',
  NO: 'Norway',
  PT: 'Portugal',
  RO: 'Romania',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TR: 'Turkey',
  US: 'United States',
  VN: 'Vietnam',
};
