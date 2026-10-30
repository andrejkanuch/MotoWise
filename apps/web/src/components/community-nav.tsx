'use client';

import { Crown, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useProStatus } from '@/hooks/use-pro-status';
import { resetUser } from '@/lib/analytics';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
// The shared Trackside component styles (.mv-plate, .mv-btn, .mv-figure):
// loaded here so every signed-in page draws the same objects as the site.
import '@/app/(community)/garage/garage.css';

const NAV_LINKS = [
  { href: '/garage', labelKey: 'garage' },
  { href: '/profile', labelKey: 'profile' },
] as const;

/**
 * The signed-in bar: a flat strip on the ground with one hairline, its
 * contents in the site's 1240 container, body-face links (the current one
 * carries a copper dot), the theme toggle, the account (avatar, name, plan
 * status in ink) and sign-out. Below 720 px the links, name, "Pro" and
 * sign-out move into a menu one step up the ramp.
 */
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

  // Close the menu on an outside click or Escape. The toggle button is
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
  // Gated on !isLoading so a Pro rider never sees a one-tick "Upgrade" flash
  // before the status resolves after hydration.
  const showUpgrade = !isLoading && !isPro && !isTrialing;
  const themeLabels = { toLight: t('themeToLight'), toDark: t('themeToDark') };

  return (
    <nav className="community-nav">
      <div className="nav-inner">
        <a href="/" className="nav-brand">
          MotoVault
        </a>

        <div className="nav-links">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={isActive ? 'nav-link active' : 'nav-link'}
                aria-current={isActive ? 'page' : undefined}
              >
                {t(link.labelKey)}
              </a>
            );
          })}
        </div>

        <div className="nav-right">
          {showUpgrade && (
            <a href="/pro" className="mv-link is-quiet is-tall nav-upgrade nav-desktop-only">
              {t('upgrade')}
            </a>
          )}

          <ThemeToggle className="mv-icon-btn" labels={themeLabels} />

          <div className="nav-user">
            <div className="nav-avatar" aria-hidden="true">
              {initial}
            </div>
            <span className="nav-name-text" title={displayName ?? undefined}>
              {displayName ?? t('rider')}
            </span>

            {isPro && !isTrialing && (
              <span className="nav-badge">
                <Crown aria-hidden="true" />
                <span className="nav-badge-word">Pro</span>
              </span>
            )}

            {isTrialing && (
              <span className="nav-badge">
                <Crown aria-hidden="true" />
                <span className="nav-badge-word">{t('trial')}</span>
                {trialDaysLeft != null && (
                  <span className="nav-trial-days">
                    {` · ${t('daysLeft', { days: trialDaysLeft })}`}
                  </span>
                )}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mv-btn mv-btn-ghost is-compact nav-desktop-only"
          >
            {signingOut ? t('signingOut') : t('signOut')}
          </button>

          <button
            type="button"
            ref={menuButtonRef}
            onClick={() => setMenuOpen((open) => !open)}
            className="mv-icon-btn nav-menu-btn"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? t('menu') : t('account')}
          >
            {menuOpen ? (
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen && (
          <div id={menuId} ref={menuRef} className="nav-mobile-menu mv-enter-down">
            <p className="nav-menu-name">{displayName ?? t('rider')}</p>
            <div className="mv-rows is-open">
              {NAV_LINKS.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={isActive ? 'mv-row nav-menu-link active' : 'mv-row nav-menu-link'}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {t(link.labelKey)}
                  </a>
                );
              })}
              {showUpgrade && (
                <a
                  href="/pro"
                  onClick={() => setMenuOpen(false)}
                  className="mv-row mv-link is-quiet nav-menu-link nav-upgrade"
                >
                  {t('upgrade')}
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mv-btn mv-btn-ghost is-compact nav-signout"
            >
              {signingOut ? t('signingOut') : t('signOut')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
