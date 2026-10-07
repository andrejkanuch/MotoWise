'use client';

import { Crown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    resetUser();
    router.push('/login');
  }, [signingOut, router]);

  // Close the mobile menu on an outside click or Escape. The toggle button is
  // excluded from the outside test: otherwise its mousedown closes the menu and
  // the click that follows re-opens it, so the X could never close the menu.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const initial = displayName?.charAt(0)?.toUpperCase() ?? 'R';

  return (
    <nav className="community-nav">
      {/* Brand */}
      <a href="/" className="nav-brand">
        <span className="nav-mark">M</span>
        <span className="nav-brand-word">MotoVault</span>
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
          <a href="/pro" className="nav-upgrade nav-desktop-only">
            {t('upgrade')} <span style={{ fontSize: '11px' }}>&rarr;</span>
          </a>
        )}

        <div className="nav-user">
          <div className="nav-avatar">{initial}</div>
          <span className="nav-name-text" title={displayName ?? undefined}>
            {displayName ?? t('rider')}
          </span>

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
              {t('trial')}
              {trialDaysLeft != null && (
                <span className="nav-trial-days">
                  {` \u00B7 ${t('daysLeft', { days: trialDaysLeft })}`}
                </span>
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="nav-signout-btn nav-desktop-only"
        >
          {signingOut ? t('signingOut') : t('signOut')}
        </button>

        {/* Mobile hamburger */}
        <button
          type="button"
          ref={menuButtonRef}
          onClick={() => setMenuOpen((open) => !open)}
          className="nav-menu-btn"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={t('menu')}
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
          id={menuId}
          ref={menuRef}
          className="nav-mobile-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            // Opaque: at 95% alpha the page's large white headings showed
            // through the open menu (the nav's own backdrop-filter means this
            // nested blur never sees the page, so it cannot hide them either).
            background: 'var(--mv-page)',
            borderBottom: '1px solid var(--mv-line)',
            padding: '16px 28px',
            zIndex: 50,
          }}
        >
          {/* Below 720px the bar keeps only the brand, avatar and menu button so
              it fits a 320px phone; the name, upgrade link and sign-out live here. */}
          <p className="nav-menu-name">{displayName ?? t('rider')}</p>
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
          {!isLoading && !isPro && !isTrialing && (
            <a
              href="/pro"
              onClick={() => setMenuOpen(false)}
              className="nav-upgrade"
              style={{ padding: '10px 0' }}
            >
              {t('upgrade')} <span style={{ fontSize: '11px' }}>&rarr;</span>
            </a>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="nav-signout-btn"
            style={{ display: 'block', marginTop: '8px' }}
          >
            {signingOut ? t('signingOut') : t('signOut')}
          </button>
        </div>
      )}
    </nav>
  );
}
