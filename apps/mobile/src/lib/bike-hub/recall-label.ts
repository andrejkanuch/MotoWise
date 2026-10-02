/** NHTSA nests a recall's component as "SYSTEM:SUBSYSTEM:PART". */
const COMPONENT_LEVEL_SEPARATOR = ':';

/** Words NHTSA writes in capitals that stay capitals in sentence case. */
const ACRONYMS: ReadonlySet<string> = new Set(['ABS', 'ECU', 'ECM', 'LED', 'TPMS', 'ESC', 'ATV']);

const WORD = /[A-Za-z]+/g;

/**
 * A recall's NHTSA component as a rider reads it: the most specific level
 * (the part after the last ':'), in sentence case — "FUEL SYSTEM,
 * GASOLINE:DELIVERY:FUEL PUMP" becomes "Fuel pump". Known acronyms keep their
 * capitals. Empty when the component is blank.
 */
export function recallComponentLabel(component: string): string {
  const levels = component
    .split(COMPONENT_LEVEL_SEPARATOR)
    .map((level) => level.trim())
    .filter((level) => level.length > 0);
  const specific = levels[levels.length - 1] ?? '';
  const lower = specific.replace(WORD, (word) =>
    ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word.toLowerCase(),
  );
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Readable labels for a list of recall components, blanks and repeats dropped, order kept. */
export function recallComponentLabels(components: readonly string[]): string[] {
  const labels = components.map(recallComponentLabel).filter((label) => label.length > 0);
  return [...new Set(labels)];
}
