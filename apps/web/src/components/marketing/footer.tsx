import { getTranslations } from 'next-intl/server';
import { ExternalLink } from '@/components/marketing/external-link';
import { Link } from '@/i18n/navigation';

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-50">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => {
          const cls = 'text-sm text-neutral-400 transition-colors hover:text-neutral-200';
          return (
            <li key={link.label}>
              {link.external ? (
                <ExternalLink href={link.href} className={cls}>
                  {link.label}
                </ExternalLink>
              ) : (
                <Link href={link.href} className={cls}>
                  {link.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function Footer() {
  const t = await getTranslations('Footer');

  const productLinks = [
    { label: t('features'), href: '/features/ai-diagnostics' },
    { label: t('learning'), href: '/features/learning-paths' },
    { label: t('garage'), href: '/features/garage-management' },
    { label: t('download'), href: '#cta' },
  ];

  const companyLinks = [
    { label: t('privacy'), href: '/privacy' },
    { label: t('terms'), href: '/terms' },
    { label: t('support'), href: '/support' },
    { label: t('accountDeletion'), href: '/account-deletion' },
  ];

  return (
    <footer className="relative bg-gradient-to-b from-transparent to-black">
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <FooterColumn title={t('product')} links={productLinks} />
          <FooterColumn title={t('company')} links={companyLinks} />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t-2 border-neutral-800 pt-8 md:flex-row">
          <div>
            <p className="text-lg font-bold text-neutral-50">
              Moto<span className="text-warm-400">Vault</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">{t('tagline')}</p>
          </div>

          <p className="text-xs text-neutral-600">{t('builtWithAi')}</p>

          <p className="text-xs text-neutral-500">{t('copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
