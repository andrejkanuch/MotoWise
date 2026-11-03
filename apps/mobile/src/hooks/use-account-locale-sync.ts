import { UpdateUserDocument } from '@motovault/graphql';
import { useEffect, useRef } from 'react';
import { applyLocalePreference } from '../i18n';
import { effectiveLocale } from '../i18n/locale';
import { captureException } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { queryClient } from '../lib/query-client';
import { queryKeys } from '../lib/query-keys';
import { useAuthStore } from '../stores/auth.store';

/**
 * Keeps `users.preferences.locale` equal to the app language this device shows,
 * so server-sent copy (maintenance and ride-idle pushes) uses it. Saves the
 * resolved base locale (`es`, `pt-BR`), never `system` or `es-ES`, which is what
 * the API's locale lookup expects.
 *
 * `preferences` is undefined until the account has loaded; nothing is written
 * before then, and at most one attempt per rider + locale, so a failing write
 * never loops.
 */
export function useAccountLocaleSync(
  userId: string | undefined,
  preferences: Record<string, unknown> | null | undefined,
): void {
  const preference = useAuthStore((s) => s.locale);
  const attempted = useRef<string | null>(null);
  const accountLocale = preferences?.locale;
  const loaded = preferences !== undefined;

  useEffect(() => {
    if (!userId || !loaded) return;
    const locale = effectiveLocale(preference);
    const attempt = `${userId}:${locale}`;
    if (accountLocale === locale || attempted.current === attempt) return;
    attempted.current = attempt;
    gqlFetcher(UpdateUserDocument, { input: { preferences: { locale } } })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }))
      .catch((e) => captureException(e, { source: 'use-account-locale-sync' }));
  }, [userId, loaded, accountLocale, preference]);
}

/**
 * Once per launch: take the Android 13+ OS per-app language (App info →
 * Language may have changed while the app was closed), then load the language.
 */
export function useLaunchLanguage(): void {
  useEffect(() => {
    useAuthStore.getState().syncLocaleWithOs();
    applyLocalePreference(useAuthStore.getState().locale);
  }, []);
}
