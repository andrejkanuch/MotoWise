import Image from 'next/image';
import { ExternalLink } from '@/components/marketing/external-link';
import { Link } from '@/i18n/navigation';
import { STORE_LINKS } from './store-buttons';

const productLinks = [
  { label: 'Trip planning', href: '/features/trip-planning' },
  { label: 'AI diagnostics', href: '/features/ai-diagnostics' },
  { label: 'Garage', href: '/features/garage-management' },
  { label: 'Learning paths', href: '/features/learning-paths' },
  { label: 'Explore routes', href: '/explore' },
] as const;

const resourceLinks = [
  { label: 'FAQ', href: '/#faq' },
  { label: 'Riders', href: '/#proof' },
  { label: 'Contact', href: 'mailto:hello@motovault.app', external: true },
] as const;

const legalLinks = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
] as const;

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

export function Footer() {
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
          <p className="mv-footer-brand-text">
            The rider&rsquo;s companion. Plan, track, maintain and diagnose — all in one free app,
            made by riders.
          </p>
          <div className="mv-footer-stores">
            <ExternalLink href={STORE_LINKS.appStore} className="mv-footer-store">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.5 12.5c0-2.4 2-3.6 2-3.6-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.4 1.2 0 1.6-.8 3-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.8zM15.3 5.5c.6-.8 1.1-1.9.9-3-1 0-2.2.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.3-.6 2.9-1.4z" />
              </svg>
              App Store
            </ExternalLink>
            <ExternalLink href={STORE_LINKS.googlePlay} className="mv-footer-store">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.6 2.8c-.3.3-.5.7-.5 1.3v15.8c0 .6.2 1 .5 1.3l9-9-9-9.4zM14.6 13.6l2.8 1.6-11.2 6.4c-.5.3-1 .2-1.3 0l9.7-8zM18.3 11.4l-3 1.7-2.6-2.5 2.6-2.6 3 1.8c.9.5.9 1.2 0 1.6zM4.9 2.4c.3-.2.8-.2 1.3 0l11.2 6.4-2.8 1.7-9.7-8.1z" />
              </svg>
              Google Play
            </ExternalLink>
          </div>
        </div>

        {/* Product */}
        <FooterColumn title="Product" links={productLinks} />

        {/* Resources */}
        <FooterColumn title="Resources" links={resourceLinks} />

        {/* Legal */}
        <FooterColumn title="Legal" links={legalLinks} />
      </div>

      {/* ── Giant outlined wordmark ── */}
      <div className="mv-footer-wordmark" aria-hidden="true">
        MotoVault
      </div>

      {/* ── Bottom bar ── */}
      <div className="mv-footer-bottom">
        <span>&copy; 2026 MotoVault &middot; Made for riders, by riders.</span>
        <span>motovault.app</span>
      </div>
    </footer>
  );
}
