import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center bg-neutral-950 text-neutral-50">
      {/* Speedometer needle */}
      <div className="relative flex size-40 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
          <path
            d="M20 90 A50 50 0 1 1 100 90"
            fill="none"
            stroke="oklch(0.27 0 0)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M20 90 A50 50 0 0 1 40 28"
            fill="none"
            stroke="oklch(0.60 0.16 45)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="60"
            y1="60"
            x2="38"
            y2="30"
            stroke="oklch(0.60 0.16 45)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="5" fill="oklch(0.60 0.16 45)" />
        </svg>
      </div>

      <div>
        <h1 className="text-7xl font-extrabold tracking-tight text-warm-400">{t('code')}</h1>
        <p className="mt-3 text-xl text-neutral-400">{t('message')}</p>
      </div>

      <Link
        href="/"
        className="cta-primary rounded-full bg-warm-500 px-8 py-3 font-semibold text-neutral-950"
      >
        {t('backHome')}
      </Link>
    </div>
  );
}
