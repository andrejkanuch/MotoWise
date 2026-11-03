// The Android 13+ per-app language, through the local AppLocale module
// (android/…/AppLocaleModule.kt). Everywhere else — iOS, Android 12 and older,
// web, Jest, or a binary built before this module existed — `isSupported` is
// false and every call is a safe no-op, so callers can run unguarded.

import { requireOptionalNativeModule } from 'expo';

type AppLocaleNative = {
  isSupported(): boolean;
  getApplicationLocales(): string;
  setApplicationLocales(tags: string): void;
};

const native = requireOptionalNativeModule<AppLocaleNative>('AppLocale');

function call<T>(fn: (module: AppLocaleNative) => T, fallback: T): T {
  if (!native) return fallback;
  try {
    return fn(native);
  } catch {
    return fallback;
  }
}

/** True when the OS keeps a per-app language this app can read and write. */
export function isAppLocaleSupported(): boolean {
  return call((m) => m.isSupported(), false);
}

/** The OS per-app languages, most preferred first; empty = follow the system. */
export function getAppLocales(): string[] {
  const tags = call((m) => m.getApplicationLocales(), '');
  return tags ? tags.split(',').filter(Boolean) : [];
}

/** Set the OS per-app language; an empty list goes back to the system language. */
export function setAppLocales(tags: readonly string[]): void {
  call((m) => m.setApplicationLocales(tags.join(',')), undefined);
}
