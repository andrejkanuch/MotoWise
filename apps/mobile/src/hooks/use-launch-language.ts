import { useEffect } from 'react';
import { applyLocalePreference } from '../i18n';
import { useAuthStore } from '../stores/auth.store';

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
