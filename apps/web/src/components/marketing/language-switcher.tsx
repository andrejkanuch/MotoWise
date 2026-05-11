'use client';

import { usePathname as useNextPathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Routes under [locale]/(marketing) support locale-prefixed URLs.
 * All other routes (trips, explore, pro, profile, etc.) do not.
 * For non-i18n routes, we set the NEXT_LOCALE cookie and reload
 * instead of rewriting the URL (which would 404).
 */
const I18N_ROUTE_PREFIXES = [
  '/features',
  '/privacy',
  '/terms',
  '/about',
  '/account-deletion',
  '/press',
  '/tools',
  '/guides',
  '/contact',
];

function isI18nRoute(path: string): boolean {
  // Strip locale prefix if present (e.g. /es/features → /features)
  const stripped = path.replace(/^\/(en|de|fr|es|it)(?=\/|$)/, '') || '/';
  // The homepage (/) is i18n-aware
  if (stripped === '/') return true;
  return I18N_ROUTE_PREFIXES.some((prefix) => stripped.startsWith(prefix));
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const intlRouter = useRouter();
  const intlPathname = usePathname();
  const browserPathname = useNextPathname();
  const t = useTranslations('LanguageSwitcher');

  function handleChange(newLocale: string) {
    if (isI18nRoute(browserPathname)) {
      // i18n route — use next-intl router to rewrite URL with locale prefix
      intlRouter.replace(intlPathname, { locale: newLocale });
    } else {
      // Non-i18n route — set cookie and reload to pick up new translations
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not universally supported
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
      window.location.reload();
    }
  }

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none bg-transparent text-sm text-neutral-400 hover:text-neutral-200 cursor-pointer pr-6 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded"
        aria-label={t('selectLanguage')}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc} className="bg-neutral-900 text-neutral-200">
            {t(loc)}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 size-4 text-neutral-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
