/**
 * Supported countries for route discovery browsing.
 * Shared between mobile and web apps.
 */
export const SUPPORTED_COUNTRY_CODES = [
  'IT',
  'ES',
  'AT',
  'DE',
  'FR',
  'CH',
  'HR',
  'GR',
  'NO',
  'RO',
  'PT',
  'US',
] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export function isSupportedCountry(
  code: string | undefined,
): code is SupportedCountryCode {
  return (
    code != null &&
    (SUPPORTED_COUNTRY_CODES as ReadonlyArray<string>).includes(code)
  );
}

export const COUNTRY_NAMES: Record<SupportedCountryCode, string> = {
  IT: 'Italy',
  ES: 'Spain',
  AT: 'Austria',
  DE: 'Germany',
  FR: 'France',
  CH: 'Switzerland',
  HR: 'Croatia',
  GR: 'Greece',
  NO: 'Norway',
  RO: 'Romania',
  PT: 'Portugal',
  US: 'United States',
};

