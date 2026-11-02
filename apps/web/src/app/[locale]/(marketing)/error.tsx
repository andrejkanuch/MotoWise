'use client';

import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* Inside the marketing layout: the fixed navbar sits above, so the shared
   hero shell clears it. The error replaces the page, so its title is the
   page's H1 at the page-title size; body face, one copper action,
   left-aligned. */
const ERROR_CSS = `
.merr {
  min-height: 70vh;
  display: flex; flex-direction: column; justify-content: center;
  max-width: var(--mv-container);
  margin: 0 auto;
}
.merr-status { margin: 0 0 24px; font-size: 15px; line-height: 20px; color: var(--mv-ink-3); }
.merr-title { margin: 0 0 20px; color: var(--mv-ink); }
.merr-message { max-width: 50ch; margin: 0; font-size: 17px; line-height: 1.55; color: var(--mv-ink-2); text-wrap: pretty; }
.merr-ref { margin: 12px 0 0; font-family: var(--mv-font-mono); font-size: 12px; line-height: 16px; color: var(--mv-ink-3); overflow-wrap: anywhere; }
.merr-actions { margin-top: 32px; }
`;

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Error');

  return (
    <div className="merr mv-section-hero">
      <style>{ERROR_CSS}</style>
      <p className="merr-status">{t('label')}</p>
      <h1 className="mv-section-title merr-title">{t('title')}</h1>
      <p className="merr-message">{t('message')}</p>
      {error.digest && <p className="merr-ref">Ref: {error.digest}</p>}
      <div className="merr-actions">
        <button onClick={reset} type="button" className="mv-btn mv-btn-primary">
          <RotateCw size={16} aria-hidden="true" />
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
