/**
 * Returns `value` only when it is a safe same-origin *relative* path (a single
 * leading slash, no scheme or host), otherwise `fallback`.
 *
 * Guards the `?redirect=` param against open-redirect / phishing: without this,
 * `window.location.href = params.get('redirect')` after login (or a
 * `<Link href={redirect}>` after checkout) would happily send the user to
 * `https://evil.com`, `//evil.com`, or `/\evil.com` (which some browsers
 * normalize to a protocol-relative URL). Only internal app paths are allowed
 * through; anything else falls back.
 *
 * Note: this is for web paths only. The mobile `motovault://` deep-link scheme
 * used in the OAuth callback is handled separately by its own branch.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/garage'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  // Reject protocol-relative (`//host`) and backslash variants (`/\host`, which
  // browsers may treat as `//host`).
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
