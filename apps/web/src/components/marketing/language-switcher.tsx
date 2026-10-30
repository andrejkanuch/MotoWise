'use client';

import { ChevronDown } from 'lucide-react';
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

function isI18nRoute(path: string | null): boolean {
  // `usePathname()` from next/navigation is typed `string | null`; treat a null
  // pathname as the homepage, which is i18n-aware.
  if (!path) return true;
  // Strip locale prefix if present (e.g. /es/features → /features)
  const stripped = path.replace(/^\/(en|de|fr|es|it|ja|pl|pt-BR)(?=\/|$)/, '') || '/';
  // The homepage (/) is i18n-aware
  if (stripped === '/') return true;
  return I18N_ROUTE_PREFIXES.some((prefix) => stripped.startsWith(prefix));
}

/* A native select dressed as a ghost control: body face, 44px tall,
   control radius; focus comes from the root grammar. Options sit on the
   raised step. */
const SWITCHER_CSS = `
.mv-lang {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.mv-lang-select {
  appearance: none;
  -webkit-appearance: none;
  min-height: 44px;
  padding: 0 32px 0 12px;
  border: 0;
  border-radius: var(--mv-radius-control);
  background: transparent;
  font-family: var(--mv-font-body);
  font-size: 15px;
  font-weight: 500;
  color: var(--mv-ink-2);
  cursor: pointer;
  transition: color .15s, background .15s;
}
.mv-lang-select:hover {
  color: var(--mv-ink);
  background: var(--mv-fill);
}
.mv-lang-select option {
  background: var(--mv-surface-2);
  color: var(--mv-ink);
}
.mv-lang-chevron {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--mv-ink-3);
}
`;

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
    <div className="mv-lang">
      <style>{SWITCHER_CSS}</style>
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="mv-lang-select"
        aria-label={t('selectLanguage')}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {t(loc)}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="mv-lang-chevron" />
    </div>
  );
}
