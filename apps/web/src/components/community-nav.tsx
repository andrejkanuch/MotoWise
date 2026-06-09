'use client';

import { Crown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProStatus } from '@/hooks/use-pro-status';
import { resetUser } from '@/lib/analytics';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import '@/app/(community)/garage/garage.css';

const NAV_LINKS = [
  { href: '/garage', labelKey: 'garage' },
  { href: '/profile', labelKey: 'profile' },
] as const;

export function CommunityNav({ displayName }: { displayName?: string | null }) {
  const t = useTranslations('CommunityNav');
  const router = useRouter();
  const pathname = usePathname();
  const { isPro, isTrialing, trialDaysLeft, isLoading } = useProStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    resetUser();
    router.push('/login');
  }, [signingOut, router]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const initial = displayName?.charAt(0)?.toUpperCase() ?? 'R';

  return (
    <nav className="community-nav">
      {/* Brand */}
      <a href="/" className="nav-brand">
        <span className="nav-mark">M</span>
        MotoVault
      </a>

      {/* Desktop pill tabs */}
      <div className="nav-pill">
        {NAV_LINKS.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <a
              key={link.href}
              href={link.href}
              className={`nav-pill-link${isActive ? ' active' : ''}`}
            >
              {isActive && <span className="dot" />}
              {t(link.labelKey)}
            </a>
          );
        })}
      </div>

      {/* Right side */}
      <div className="nav-right">
        {/* Free user upgrade link — gated on !isLoading so Pro users don't get
            a one-tick "Upgrade" flash before status resolves post-hydration. */}
        {!isLoading && !isPro && !isTrialing && (
          <a href="/pro" className="nav-upgrade">
            {t('upgrade')} <span style={{ fontSize: '11px' }}>&rarr;</span>
          </a>
        )}

        <div className="nav-user">
          <div className="nav-avatar">{initial}</div>
          <span className="nav-name-text">{displayName ?? t('rider')}</span>

          {/* Pro badge */}
          {isPro && !isTrialing && (
            <span className="nav-badge pro">
              <span className="nav-crown">
                <Crown />
              </span>
              Pro
            </span>
          )}

          {/* Trial badge */}
          {isTrialing && (
            <span className="nav-badge trial">
              <span className="nav-crown">
                <Crown />
              </span>
              {t('trial')}{' '}
              {trialDaysLeft != null ? `\u00B7 ${t('daysLeft', { days: trialDaysLeft })}` : ''}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="nav-signout-btn"
        >
          {signingOut ? t('signingOut') : t('signOut')}
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg sm:hidden"
          style={{ color: 'var(--mv-ink-2)', background: 'transparent', border: 'none' }}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <title>{t('menu')}</title>
            {menuOpen ? (
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'oklch(0.085 0.008 55 / 0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--mv-line)',
            padding: '16px 28px',
            zIndex: 50,
          }}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="nav-pill-link"
              style={{
                display: 'block',
                padding: '10px 0',
                color: pathname.startsWith(link.href) ? 'var(--mv-warm-400)' : 'var(--mv-ink-2)',
              }}
            >
              {t(link.labelKey)}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
