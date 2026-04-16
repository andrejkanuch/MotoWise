export type UserPreferencesPatch = {
  /**
   * Deep-merged (one level) onto the existing `me.preferences` blob.
   * Top-level keys (e.g. `notifications`, `privacy`) are shallow-merged so sibling
   * blocks are preserved when writing a single block. Arrays and scalars replace.
   */
  preferences?: Record<string, unknown>;
  fullName?: string;
  measurementSystem?: 'metric' | 'imperial';
  currency?: string;
};

export type UpdateInput = {
  fullName?: string;
  measurementSystem?: string;
  currency?: string;
  preferences?: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeOneLevel(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...current };
  for (const key of Object.keys(patch)) {
    const existing = result[key];
    const next = patch[key];
    if (isPlainObject(existing) && isPlainObject(next)) {
      result[key] = { ...existing, ...next };
    } else {
      result[key] = next;
    }
  }
  return result;
}

export function hasRootFields(patch: UserPreferencesPatch): boolean {
  return (
    patch.fullName !== undefined ||
    patch.measurementSystem !== undefined ||
    patch.currency !== undefined
  );
}

/**
 * Pure function that computes the GraphQL `UpdateUserInput` payload from a patch and the
 * current cached preferences. Kept in its own module so it can be unit-tested without pulling
 * in any React Native native modules (AsyncStorage, etc.).
 */
export function buildUpdateInput(
  patch: UserPreferencesPatch,
  currentPrefs: Record<string, unknown> | undefined,
): UpdateInput {
  const input: UpdateInput = {};
  if (patch.fullName !== undefined) input.fullName = patch.fullName;
  if (patch.measurementSystem !== undefined) input.measurementSystem = patch.measurementSystem;
  if (patch.currency !== undefined) input.currency = patch.currency;

  if (patch.preferences !== undefined) {
    input.preferences = currentPrefs
      ? mergeOneLevel(currentPrefs, patch.preferences)
      : patch.preferences;
  }
  return input;
}
