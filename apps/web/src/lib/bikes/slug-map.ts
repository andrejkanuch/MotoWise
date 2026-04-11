/**
 * Bidirectional slug normalization for motorcycle makes and models.
 *
 * Rules:
 * - Lowercase
 * - Strip Unicode diacritics via NFD decomposition
 * - Replace any non-alphanumeric run with a single `-`
 * - Trim leading/trailing `-`
 *
 * Examples:
 *   Harley-Davidson → harley-davidson
 *   Moto Guzzi      → moto-guzzi
 *   YZF-R1          → yzf-r1
 *   Royal Enfield   → royal-enfield
 *   Aprilia Tuono V4 1100 Factory → aprilia-tuono-v4-1100-factory
 */

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function makeSlug(name: string): string {
  return normalize(name);
}

export function modelSlug(name: string): string {
  return normalize(name);
}

/**
 * Reverse a slug into a human-readable string. This is a lossy operation — it
 * cannot restore the original casing or punctuation (e.g. `harley-davidson`
 * returns `Harley Davidson`, not `Harley-Davidson`). Callers that need the
 * exact original should look up the canonical name via the fixture / snapshot.
 */
export function unslug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}
