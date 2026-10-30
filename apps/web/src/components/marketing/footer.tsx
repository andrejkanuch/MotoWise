import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from '@/i18n/navigation';

const MAILTO_PREFIX = 'mailto:';

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div>
      <div className="mv-footer-col-title">{title}</div>
      {links.map((link) =>
        // A mail link stays in the same tab: a new tab with no mail handler
        // would sit empty.
        link.href.startsWith(MAILTO_PREFIX) ? (
          <a key={link.label} href={link.href} className="mv-footer-link">
            {link.label}
          </a>
        ) : (
          <Link key={link.label} href={link.href} className="mv-footer-link">
            {link.label}
          </Link>
        ),
      )}
    </div>
  );
}

/** The footer lists every feature page and both tools so no page needs a
 *  "related" list of its own; the store buttons are not repeated here —
 *  every page closes with a pair 200–300px above, and the sticky bar covers
 *  scroll depth. The outlined wordmark stays as the one decoration. */
export async function Footer() {
  const t = await getTranslations('Footer');
  const tNav = await getTranslations('Navbar');
  const themeLabels = { toLight: tNav('themeToLight'), toDark: tNav('themeToDark') };

  const productLinks = [
    { label: t('linkTripPlanning'), href: '/features/trip-planning' },
    { label: t('linkAiDiagnostics'), href: '/features/ai-diagnostics' },
    { label: t('linkMaintenance'), href: '/features/maintenance' },
    { label: t('linkExpenseTracking'), href: '/features/expense-tracking' },
    { label: t('linkRideTracking'), href: '/features/ride-tracking' },
    { label: t('linkGarage'), href: '/features/garage-management' },
    { label: t('linkLearningPaths'), href: '/features/learning-paths' },
  ] as const;

  const resourceLinks = [
    { label: t('linkGuides'), href: '/guides' },
    { label: t('linkCostCalculator'), href: '/tools/cost-calculator' },
    { label: t('linkTclocsChecklist'), href: '/tools/tclocs-checklist' },
    { label: t('faq'), href: '/#faq' },
    { label: t('contact'), href: `${MAILTO_PREFIX}support@motovault.app` },
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

      {/* ── Bottom row: copyright and the scheme switch ── */}
      <div className="mv-footer-bottom">
        <span>{t('bottomBar')}</span>
        <span className="mv-footer-bottom-right">
          {/* The visible name of the one unlabelled control here; the button
              keeps its own action label for assistive tech. */}
          <span aria-hidden="true">{t('theme')}</span>
          <ThemeToggle className="mv-icon-btn" labels={themeLabels} />
        </span>
      </div>
      <div className="mv-footer-operator">{t('operatorLine')}</div>
    </footer>
  );
}
