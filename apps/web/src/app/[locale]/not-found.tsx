import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import '@/components/marketing/design-system.css';

/* The shared hero shell on the page container; H1 at the page-title size,
   body face, one copper action; left-aligned on the ground. */
const NOT_FOUND_CSS = `
.nfl {
  min-height: 100vh;
  display: flex; flex-direction: column; justify-content: center;
  max-width: var(--mv-container);
  margin: 0 auto;
  background: var(--mv-bg);
}
.nfl-status { display: flex; gap: 14px; align-items: baseline; margin: 0 0 24px; font-size: 15px; line-height: 20px; color: var(--mv-ink-3); }
.nfl-status .mv-figure { font-size: 20px; color: var(--mv-ink-2); }
.nfl-title { margin: 0 0 20px; color: var(--mv-ink); }
.nfl-actions { margin-top: 16px; }
`;

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="mv-marketing">
      <style>{NOT_FOUND_CSS}</style>
      <main className="nfl mv-section-hero">
        <p className="nfl-status">
          <span className="mv-figure">{t('code')}</span>
          <span>{t('label')}</span>
        </p>
        <h1 className="mv-section-title nfl-title">{t('message')}</h1>
        <div className="nfl-actions">
          <Link href="/" className="mv-btn mv-btn-primary">
            {t('backHome')}
          </Link>
        </div>
      </main>
    </div>
  );
}
