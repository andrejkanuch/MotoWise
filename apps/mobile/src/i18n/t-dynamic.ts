import type { TFunction, TOptions } from 'i18next';

/**
 * `t()` for a key assembled at run time: `onboarding.${step}`, a key read from a
 * config row, a wizard answer. The typed `t()` cannot check such a key, so this
 * is the one place a translation key is cast. A literal key calls `t()` directly
 * and keeps its compile-time check; never cast at a `t()` call site.
 */
export function tDynamic(t: TFunction, key: string, options?: TOptions): string {
  return t(key as never, options as never) as unknown as string;
}
