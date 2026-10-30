import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import '@/components/marketing/design-system.css';

/* Condensed headline, body face, one copper action; left-aligned on the ground. */
const NOT_FOUND_CSS = `
.nfl {
  min-height: 100vh;
  display: flex; flex-direction: column; justify-content: center;
  max-width: var(--mv-container);
  margin: 0 auto;
  padding: 120px 40px 80px;
  background: var(--mv-bg);
}
.nfl-status { display: flex; gap: 14px; align-items: baseline; margin: 0 0 24px; font-size: 14px; color: var(--mv-ink-3); }
.nfl-status .mv-figure { font-size: 18px; color: var(--mv-ink-2); }
.nfl-title {
  margin: 0 0 20px;
  font-family: var(--mv-font-display); font-weight: 700;
  font-size: clamp(56px, 8vw, 112px); line-height: 0.94; letter-spacing: 0.002em;
  color: var(--mv-ink); text-wrap: balance;
}
.nfl-actions { margin-top: 16px; }
@media (max-width: 600px) { .nfl { padding: 100px 24px 64px; } }
`;

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="mv-marketing">
      <style>{NOT_FOUND_CSS}</style>
      <main className="nfl">
        <p className="nfl-status">
          <span className="mv-figure">{t('code')}</span>
          <span>{t('label')}</span>
        </p>
        <h1 className="nfl-title">{t('message')}</h1>
        <div className="nfl-actions">
          <Link href="/" className="mv-btn mv-btn-primary">
            {t('backHome')}
          </Link>
        </div>
      </main>
    </div>
  );
}
