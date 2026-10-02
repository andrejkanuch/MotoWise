/** NHTSA nests a recall's component as "SYSTEM:SUBSYSTEM:PART". */
const COMPONENT_LEVEL_SEPARATOR = ':';

/** Words NHTSA writes in capitals that stay capitals in sentence case. */
const ACRONYMS: ReadonlySet<string> = new Set([
  'ABS',
  'ECU',
  'ECM',
  'LED',
  'TPMS',
  'ESC',
  'ATV',
  'DCT',
  'CVT',
  'TCM',
  'PCM',
  'BCM',
  'EVAP',
  'USB',
  'VIN',
]);

/**
 * Catch-all levels that name nothing ("UNKNOWN OR OTHER", "…:OTHER"): the level
 * before them is the more useful label.
 */
const GENERIC_LEVELS: ReadonlySet<string> = new Set(['OTHER', 'UNKNOWN', 'UNKNOWN OR OTHER']);

/** A word in any script, digits included, so "12V" stays one token. */
const WORD = /[\p{L}\p{N}]+/gu;
const DIGIT = /\p{N}/u;

function caseWord(word: string): string {
  if (DIGIT.test(word)) return word; // "12V", "4WD": left as NHTSA wrote them
  const upper = word.toUpperCase();
  return ACRONYMS.has(upper) ? upper : word.toLowerCase();
}

/** The most specific level that names something; a generic last level falls back. */
function specificLevel(levels: readonly string[]): string {
  const named = levels.filter((level) => !GENERIC_LEVELS.has(level.toUpperCase()));
  return named[named.length - 1] ?? levels[levels.length - 1] ?? '';
}

/**
 * A recall's NHTSA component as a rider reads it: the most specific level
 * (the part after the last ':'), in sentence case — "FUEL SYSTEM,
 * GASOLINE:DELIVERY:FUEL PUMP" becomes "Fuel pump". Known acronyms keep their
 * capitals, words with a digit are left alone ("12V battery"), and a generic
 * last level ("OTHER") gives way to the one before it. Empty when the
 * component is blank.
 */
export function recallComponentLabel(component: string): string {
  const levels = component
    .split(COMPONENT_LEVEL_SEPARATOR)
    .map((level) => level.trim())
    .filter((level) => level.length > 0);
  const cased = specificLevel(levels).replace(WORD, caseWord);
  return cased.charAt(0).toUpperCase() + cased.slice(1);
}

/** Readable labels for a list of recall components, blanks and repeats dropped, order kept. */
export function recallComponentLabels(components: readonly string[]): string[] {
  const labels = components.map(recallComponentLabel).filter((label) => label.length > 0);
  return [...new Set(labels)];
}
