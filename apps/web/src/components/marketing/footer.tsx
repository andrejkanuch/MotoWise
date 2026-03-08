import Link from 'next/link';
import { ExternalLink } from './external-link';

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Download', href: '#cta' },
  { label: 'FAQ', href: '#faq' },
];

const companyLinks = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

const socialLinks = [
  { label: 'Instagram', href: '#' },
  { label: 'YouTube', href: '#' },
  { label: 'X', href: '#' },
];

function FooterColumn({
  title,
  links,
  external = false,
}: {
  title: string;
  links: { label: string; href: string }[];
  external?: boolean;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-50 uppercase tracking-wider">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            {external ? (
              <ExternalLink
                href={link.href}
                className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {link.label}
              </ExternalLink>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative bg-gradient-to-b from-transparent to-black">
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Connect" links={socialLinks} external />
        </div>

        <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-neutral-50">MotoLearn</p>
            <p className="text-xs text-neutral-500 mt-1">Learn your bike. Fix your bike.</p>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-xs text-neutral-500">&copy; 2026 MotoLearn. All rights reserved.</p>
            <Link
              href="/admin"
              className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
