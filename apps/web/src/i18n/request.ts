import * as rootParams from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * The locale comes from the `[locale]` root segment (`next/root-params`):
 * `app/[locale]/layout.tsx` is a root layout, so the param is available to
 * every server call in that tree, static rendering included. Root-only routes
 * (`app/(root)/**`: auth, garage, explore, trips, pro…) have no locale param
 * and render in the default locale. An explicit `locale` argument (e.g.
 * `getTranslations({locale})`) wins over the param.
 *
 * Why not the middleware header / `setRequestLocale`: under the marketing
 * layout's `force-static` the header is empty, and the request-locale store
 * was resolved as `en` before the page could set it, so every /de, /fr, …
 * page shipped in English (fixed 2026-10-30).
 */
export default getRequestConfig(async ({ locale }) => {
  let resolved = locale;
  if (!resolved) {
    const param = await rootParams.locale();
    resolved = hasLocale(routing.locales, param) ? param : routing.defaultLocale;
  }
  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
  };
});
