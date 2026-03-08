'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('LanguageSwitcher');

  function handleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none bg-transparent text-sm text-neutral-400 hover:text-neutral-200 cursor-pointer pr-6 transition-colors focus:outline-none focus:text-neutral-200"
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
