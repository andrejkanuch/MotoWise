/**
 * Minimal semver ordering for app versions ("3.28.0"). Numeric segments only;
 * a missing minor or patch segment counts as 0. Anything else (pre-release
 * tags, a leading "v", extra segments, whitespace) is not comparable, and
 * callers treat "not comparable" as "do nothing".
 */

const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;
const SEGMENT_COUNT = 3;

export type ParsedVersion = readonly [number, number, number];

export function parseVersion(version: string | null | undefined): ParsedVersion | null {
  if (!version || !VERSION_PATTERN.test(version)) return null;
  const segments = version.split('.').map(Number);
  while (segments.length < SEGMENT_COUNT) segments.push(0);
  return segments as unknown as ParsedVersion;
}

/** -1, 0 or 1 as `a` is older than, equal to or newer than `b`; null when either is junk. */
export function compareVersions(
  a: string | null | undefined,
  b: string | null | undefined,
): -1 | 0 | 1 | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}
