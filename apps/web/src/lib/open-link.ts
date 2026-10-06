// -------------------------------------------------------------------
// /open/garage — the web → app hand-off link
// -------------------------------------------------------------------
// Every "open the app" link on a signed-in web page points here, with
// `?from=<placement>`. The route counts the open by placement and platform,
// then sends the visitor to /get?src=web_profile: a phone goes to its store
// with web_profile attribution, a desktop sees the QR page.
// The path is ready to become a universal link (AASA + a mobile route) without
// a change to the pages that link to it.
// -------------------------------------------------------------------

export const OPEN_GARAGE_PATH = '/open/garage';
export const OPEN_FROM_PARAM = 'from';

/** The placements that link to /open/garage. Anything else is counted as `other`. */
export const OpenFrom = {
  Welcome: 'welcome',
  WelcomeQr: 'welcome_qr',
  GarageEmpty: 'garage_empty',
  Other: 'other',
} as const;
export type OpenFrom = (typeof OpenFrom)[keyof typeof OpenFrom];

const KNOWN_FROM = new Set<string>(Object.values(OpenFrom));

export function normalizeOpenFrom(raw: string | null | undefined): OpenFrom {
  const value = raw?.trim().toLowerCase();
  return value && KNOWN_FROM.has(value) ? (value as OpenFrom) : OpenFrom.Other;
}

export function openGarageHref(from: OpenFrom): string {
  return `${OPEN_GARAGE_PATH}?${OPEN_FROM_PARAM}=${from}`;
}
