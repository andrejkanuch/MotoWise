/**
 * Returns `value` only when it is a safe same-origin *relative* path (a single
 * leading slash, no scheme or host), otherwise `fallback`.
 *
 * Guards the `?redirect=` param against open-redirect / phishing: without this,
 * `window.location.href = params.get('redirect')` after login (or a
 * `<Link href={redirect}>` after checkout) would happily send the user to
 * `https://evil.com`, `//evil.com`, `/\evil.com` (which some browsers
 * normalize to a protocol-relative URL), or `/<TAB>/evil.com` (the URL parser
 * strips the tab, leaving `//evil.com`). Only internal app paths are allowed
 * through; anything else falls back.
 *
 * Note: this is for web paths only. The mobile `motovault://` deep-link scheme
 * used in the OAuth callback is handled separately by its own branch.
 */

/**
 * Any ASCII control character (C0 range or DEL) or a backslash. The WHATWG URL
 * parser silently REMOVES tab / LF / CR from anywhere in a URL and treats `\`
 * like `/`, so `/\t/evil.com` (from `?redirect=/%09/evil.com`) passes the
 * prefix checks yet navigates to `//evil.com`. No real app path contains them.
 */
const LAST_C0_CONTROL = 0x1f;
const DEL = 0x7f;
const BACKSLASH = 0x5c;

function hasUnsafeUrlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= LAST_C0_CONTROL || code === DEL || code === BACKSLASH) return true;
  }
  return false;
}

/** A throwaway origin to resolve the candidate against; only equality matters. */
const PARSE_ORIGIN = 'https://redirect-check.invalid';

export function safeRedirectPath(value: string | null | undefined, fallback = '/garage'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  // Reject protocol-relative (`//host`) and backslash variants (`/\host`, which
  // browsers may treat as `//host`).
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (hasUnsafeUrlChar(value)) return fallback;
  // Belt and braces: resolve it the way a browser would and require it to stay
  // on the same origin.
  try {
    if (new URL(value, PARSE_ORIGIN).origin !== PARSE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
