import NextLink from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-50 uppercase tracking-wider">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer() {
  const t = await getTranslations('Footer');

  const productLinks = [
    { label: t('features'), href: '#features' },
    { label: t('download'), href: '#cta' },
    { label: t('faq'), href: '#faq' },
  ];

  const companyLinks = [
    { label: t('privacy'), href: '/privacy' },
    { label: t('terms'), href: '/terms' },
  ];

  return (
    <footer className="relative bg-gradient-to-b from-transparent to-black">
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FooterColumn title={t('product')} links={productLinks} />
          <FooterColumn title={t('company')} links={companyLinks} />
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-50">MotoWise</p>
            <p className="text-xs text-neutral-500 mt-1">{t('tagline')}</p>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-xs text-neutral-500">{t('copyright')}</p>
            <NextLink
              href="/admin"
              className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              {t('admin')}
            </NextLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
