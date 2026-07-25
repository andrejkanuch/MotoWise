import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Standalone, English-only layout for Piel's public legal + support pages.
 *
 * These live outside the [locale] marketing tree on purpose: Piel is a separate
 * product hosted on motovault.app only to satisfy the App Store's "Privacy
 * Policy URL" and "Support URL" requirements, so the pages carry Piel's own
 * warm identity rather than MotoVault's dark marketing chrome, and skip i18n.
 *
 * `force-static` mirrors the marketing layout: the shared root layout reads
 * request headers (getLocale/getMessages) and would otherwise force these
 * routes dynamic. Nothing here reads request data, so static rendering is safe.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: {
    default: 'Piel',
    template: '%s | Piel',
  },
  description: 'Piel — a personalized skincare companion. Privacy and support.',
};

const PIEL = {
  bg: '#F8F4EC',
  surface: '#FFFFFF',
  ink: '#2B2724',
  ink2: '#6B635B',
  accent: '#B08968',
  line: 'rgba(43, 39, 36, 0.1)',
};

export default function PielLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: PIEL.bg,
        color: PIEL.ink,
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
      }}
    >
      <header
        style={{
          borderBottom: `1px solid ${PIEL.line}`,
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            maxWidth: 768,
            display: 'flex',
            gap: 24,
            alignItems: 'baseline',
          }}
        >
          <Link
            href="/piel/privacy"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: PIEL.ink,
              textDecoration: 'none',
              letterSpacing: '-0.02em',
            }}
          >
            Piel
          </Link>
          <nav style={{ display: 'flex', gap: 20, fontSize: 15 }}>
            <Link href="/piel/privacy" style={{ color: PIEL.ink2, textDecoration: 'none' }}>
              Privacy
            </Link>
            <Link href="/piel/support" style={{ color: PIEL.ink2, textDecoration: 'none' }}>
              Support
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ margin: '0 auto', maxWidth: 768, padding: '48px 24px 96px' }}>{children}</main>

      <footer
        style={{
          borderTop: `1px solid ${PIEL.line}`,
          padding: '24px',
          fontSize: 14,
          color: PIEL.ink2,
        }}
      >
        <div style={{ margin: '0 auto', maxWidth: 768 }}>
          © {new Date().getFullYear()} Piel ·{' '}
          <a href="mailto:support@motovault.app" style={{ color: PIEL.accent }}>
            support@motovault.app
          </a>
        </div>
      </footer>
    </div>
  );
}
