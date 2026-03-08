'use client';

import { useTranslations } from 'next-intl';

export default function MarketingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Error');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h2 className="text-2xl font-bold text-neutral-50">{t('title')}</h2>
      <p className="max-w-md text-neutral-400">{t('message')}</p>
      <button
        onClick={reset}
        type="button"
        className="rounded-[--radius-button] bg-primary-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
      >
        {t('retry')}
      </button>
    </div>
  );
}
