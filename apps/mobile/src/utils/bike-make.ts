/** Fewest non-space characters a free-typed ("Other") make may have. */
export const MIN_CUSTOM_MAKE_CHARS = 3;

/**
 * A make is real when it matches one from the makes list (any length, e.g.
 * "TM") or, when free-typed, has at least {@link MIN_CUSTOM_MAKE_CHARS}
 * non-space characters — so 1–2 character junk like "H" never becomes a bike.
 */
export function isValidMakeName(name: string, knownMakes: readonly string[]): boolean {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;
  if (knownMakes.some((make) => make.toLowerCase() === trimmed)) return true;
  return trimmed.replace(/\s/g, '').length >= MIN_CUSTOM_MAKE_CHARS;
}
