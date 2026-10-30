'use client';

import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* Inside the marketing layout: the fixed navbar sits above, so the block
   clears it. Condensed headline, body face, one copper action, left-aligned. */
const ERROR_CSS = `
.merr {
  min-height: 70vh;
  display: flex; flex-direction: column; justify-content: center;
  max-width: var(--mv-container);
  margin: 0 auto;
  padding: 140px 40px 96px;
}
.merr-status { margin: 0 0 24px; font-size: 14px; color: var(--mv-ink-3); }
.merr-title {
  margin: 0 0 20px;
  font-family: var(--mv-font-display); font-weight: 700;
  font-size: clamp(48px, 7vw, 96px); line-height: 0.94; letter-spacing: 0.002em;
  color: var(--mv-ink); text-wrap: balance;
}
.merr-message { max-width: 50ch; margin: 0; font-size: 17px; line-height: 1.55; color: var(--mv-ink-2); }
.merr-ref { margin: 12px 0 0; font-family: var(--mv-font-mono); font-size: 12px; color: var(--mv-ink-3); overflow-wrap: anywhere; }
.merr-actions { margin-top: 36px; }
@media (max-width: 600px) { .merr { padding: 110px 24px 64px; } }
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
    <div className="merr">
      <style>{ERROR_CSS}</style>
      <p className="merr-status">{t('label')}</p>
      <h2 className="merr-title">{t('title')}</h2>
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
