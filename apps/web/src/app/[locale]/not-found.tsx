import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center bg-neutral-950 text-neutral-50">
      <h1 className="text-6xl font-extrabold tracking-tight">{t('code')}</h1>
      <p className="text-lg text-neutral-400">{t('message')}</p>
      <Link
        href="/"
        className="rounded-full bg-warm-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-opacity hover:opacity-90"
      >
        {t('backHome')}
      </Link>
    </div>
  );
}
