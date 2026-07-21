import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ExternalLink } from '@/components/marketing/external-link';
import { Link } from '@/i18n/navigation';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { StoreLink } from './store-buttons';

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string; external?: boolean }>;
}) {
  return (
    <div>
      <div className="mv-footer-col-title">{title}</div>
      {links.map((link) =>
        link.external ? (
          <ExternalLink key={link.label} href={link.href} className="mv-footer-link">
            {link.label}
          </ExternalLink>
        ) : (
          <Link key={link.label} href={link.href} className="mv-footer-link">
            {link.label}
          </Link>
        ),
      )}
    </div>
  );
}

export async function Footer() {
  const t = await getTranslations('Footer');

  const productLinks = [
    { label: t('linkTripPlanning'), href: '/features/trip-planning' },
    { label: t('linkAiDiagnostics'), href: '/features/ai-diagnostics' },
    { label: t('linkMaintenance'), href: '/features/maintenance' },
    { label: t('linkExpenseTracking'), href: '/features/expense-tracking' },
    { label: t('linkRideTracking'), href: '/features/ride-tracking' },
  ] as const;

  const resourceLinks = [
    { label: t('linkGuides'), href: '/guides' },
    { label: t('faq'), href: '/#faq' },
    { label: t('riders'), href: '/#proof' },
    { label: t('contact'), href: 'mailto:support@motovault.app', external: true },
  ] as const;

  const legalLinks = [
    { label: t('privacy'), href: '/privacy' },
    { label: t('terms'), href: '/terms' },
  ] as const;

  return (
    <footer className="mv-footer">
      {/* ── 4-column grid ── */}
      <div className="mv-footer-grid">
        {/* Brand column */}
        <div>
          <Link href="/" className="mv-footer-brand">
            <span className="mv-footer-brand-mark">
              <Image src="/images/marketing/MotoVault.png" alt="MotoVault" width={28} height={28} />
            </span>
            MotoVault
          </Link>
          <p className="mv-footer-brand-text">{t('brandText')}</p>
          <div className="mv-footer-stores">
            <StoreLink
              platform={StorePlatform.Ios}
              pageType={CtaPageType.Home}
              placement={CtaPlacement.Footer}
              className="mv-footer-store"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.5 12.5c0-2.4 2-3.6 2-3.6-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.4 1.2 0 1.6-.8 3-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.8zM15.3 5.5c.6-.8 1.1-1.9.9-3-1 0-2.2.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.3-.6 2.9-1.4z" />
              </svg>
              {t('appStore')}
            </StoreLink>
            <StoreLink
              platform={StorePlatform.Android}
              pageType={CtaPageType.Home}
              placement={CtaPlacement.Footer}
              className="mv-footer-store"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.6 2.8c-.3.3-.5.7-.5 1.3v15.8c0 .6.2 1 .5 1.3l9-9-9-9.4zM14.6 13.6l2.8 1.6-11.2 6.4c-.5.3-1 .2-1.3 0l9.7-8zM18.3 11.4l-3 1.7-2.6-2.5 2.6-2.6 3 1.8c.9.5.9 1.2 0 1.6zM4.9 2.4c.3-.2.8-.2 1.3 0l11.2 6.4-2.8 1.7-9.7-8.1z" />
              </svg>
              {t('googlePlay')}
            </StoreLink>
          </div>
        </div>

        {/* Product */}
        <FooterColumn title={t('product')} links={productLinks} />

        {/* Resources */}
        <FooterColumn title={t('resources')} links={resourceLinks} />

        {/* Legal */}
        <FooterColumn title={t('legal')} links={legalLinks} />
      </div>

      {/* ── Giant outlined wordmark ── */}
      <div className="mv-footer-wordmark" aria-hidden="true">
        MotoVault
      </div>

      {/* ── Bottom bar ── */}
      <div className="mv-footer-bottom">
        <span>{t('bottomBar')}</span>
        <span>motovault.app</span>
      </div>
    </footer>
  );
}
