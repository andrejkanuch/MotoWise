'use client';

import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useModal } from '@/hooks/use-modal';
import { Link, usePathname } from '@/i18n/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LanguageSwitcher } from './language-switcher';

/* Three plain links: the features index, the route directory, Pro. No
   dropdown — the index page already groups all seven feature pages. */
const NAV_LINKS = [
  { key: 'features', href: '/features' },
  { key: 'explore', href: '/explore' },
  { key: 'pro', href: '/pro' },
] as const;

const SCROLL_ACTIVATE = 80;
const SCROLL_DEACTIVATE = 20;

/** Published by the cookie banner while a consent surface is on screen. */
const COOKIE_BANNER_HEIGHT_VAR = '--mv-cookie-banner-h';

/*
 * The bar is flat on the ramp. Transparent at the top of the page; once
 * scrolled it sits on the raised glass step with the site's ONE backdrop
 * blur (12px). Its children sit in a 1240 inner container so the wordmark
 * shares the left edge with every section's H1 on wide viewports.
 * design-system.css keys the light-scheme hero overrides on
 * `.mv-navbar[data-scrolled]` / `.mv-navbar:not([data-scrolled])`, so the
 * open mobile sheet also sets data-scrolled: it leaves the dark hero scene
 * and sits on the same ground as the sheet (opaque, no blur). Only colour
 * transitions on the scroll flip; the 8px padding step snaps. The bar
 * collapses to the sheet below 1024px so the German, Spanish and Polish
 * labels never wrap inside it. Reduced motion is the kit's policy.
 */
const NAVBAR_CSS = `
.mv-navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  min-height: 72px;
  padding: 14px 40px;
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
  background: transparent;
  border-bottom: 1px solid transparent;
  transition: background .3s var(--mv-ease), border-color .3s var(--mv-ease);
}
.mv-navbar[data-scrolled] {
  padding: 10px 40px;
  min-height: 64px;
  background: var(--mv-surface-2-glass);
  border-bottom-color: var(--mv-line);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
.mv-navbar[data-menu-open] {
  background: var(--mv-bg);
  border-bottom-color: var(--mv-line);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.mv-navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  max-width: var(--mv-container);
  margin: 0 auto;
}
.mv-nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--mv-ink);
  text-decoration: none;
  white-space: nowrap;
  border-radius: var(--mv-radius-control);
}
.mv-nav-brand img {
  width: 32px; height: 32px;
  border-radius: var(--mv-radius-small);
  display: block;
}
.mv-nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
}
.mv-nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--mv-radius-control);
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
  color: var(--mv-ink-2);
  background: transparent;
  border: 0;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: color .15s, background .15s;
}
.mv-nav-link:hover {
  color: var(--mv-ink);
  background: var(--mv-fill);
}
.mv-nav-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* The icon buttons are the kit's .mv-icon-btn; the account action is the
   kit's .mv-btn (.is-compact in the bar, .mv-btn-block in the sheet) and the
   sign-in link shares .mv-nav-link with the rest of the bar. */
.mv-nav-burger {
  display: none;
}
/* Mobile sheet: full height on the ground, no blur. Its actions clear the
   cookie bar while that is up (the banner publishes its height). */
.mv-nav-sheet {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  flex-direction: column;
  padding-top: 64px;
  background: var(--mv-bg);
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
}
.mv-nav-sheet-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 24px calc(24px + env(safe-area-inset-bottom) + var(${COOKIE_BANNER_HEIGHT_VAR}, 0px));
}
.mv-nav-sheet-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}
.mv-nav-sheet-link {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 0 4px;
  font-size: 22px;
  font-weight: 500;
  line-height: 28px;
  color: var(--mv-ink);
  text-decoration: none;
  border-radius: var(--mv-radius-control);
}
.mv-nav-sheet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--mv-line);
}
.mv-nav-sheet-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
}
@media (max-width: 1024px) {
  .mv-nav-links, .mv-nav-right { display: none; }
  .mv-nav-burger { display: inline-flex; }
}
@media (max-width: 900px) {
  .mv-navbar, .mv-navbar[data-scrolled] { padding-left: 24px; padding-right: 24px; }
}
@media (max-width: 480px) {
  .mv-navbar, .mv-navbar[data-scrolled] { padding-left: 20px; padding-right: 20px; }
}
`;

export function Navbar() {
  const pathname = usePathname();
  const t = useTranslations('Navbar');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const scrolledRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const themeLabels = { toLight: t('themeToLight'), toDark: t('themeToDark') };

  // Check auth state on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Scroll hysteresis
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (!scrolledRef.current && y >= SCROLL_ACTIVATE) {
        scrolledRef.current = true;
        setScrolled(true);
      } else if (scrolledRef.current && y <= SCROLL_DEACTIVATE) {
        scrolledRef.current = false;
        setScrolled(false);
      }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on pathname change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — close menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // The sheet is a modal dialog: focus trap, Escape, scroll lock, first link
  // focused on open. The page behind it is inert for the duration.
  useModal(mobileOpen, closeMobile, sheetRef, firstLinkRef);

  useEffect(() => {
    const behind = document.querySelectorAll<HTMLElement>('main, footer');
    for (const el of behind) el.inert = mobileOpen;
    return () => {
      for (const el of behind) el.inert = false;
    };
  }, [mobileOpen]);

  // Return focus to the burger only after a real close — never on page load.
  useEffect(() => {
    if (mobileOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  // One copper verb per surface: compact in the bar, full-width in the sheet.
  const accountAction = (surface: 'bar' | 'sheet') => {
    const primary =
      surface === 'bar' ? 'mv-btn mv-btn-primary is-compact' : 'mv-btn mv-btn-primary mv-btn-block';
    const signIn = surface === 'bar' ? 'mv-nav-link' : 'mv-btn mv-btn-ghost mv-btn-block';
    return isLoggedIn ? (
      <a href="/garage" className={primary} onClick={closeMobile}>
        {t('dashboard')}
      </a>
    ) : (
      <>
        <a href="/login" className={signIn} onClick={closeMobile}>
          {t('login')}
        </a>
        <Link href="/#download" className={primary} onClick={closeMobile}>
          {t('getTheApp')}
        </Link>
      </>
    );
  };

  return (
    <>
      <style>{NAVBAR_CSS}</style>
      <nav
        className="mv-navbar"
        data-scrolled={scrolled || mobileOpen ? 'true' : undefined}
        data-menu-open={mobileOpen ? 'true' : undefined}
      >
        <div className="mv-navbar-inner">
          {/* Brand */}
          <Link href="/" className="mv-nav-brand">
            <Image src="/images/marketing/MotoVault.png" alt="" width={32} height={32} />
            MotoVault
          </Link>

          {/* Desktop links */}
          <div className="mv-nav-links">
            {NAV_LINKS.map((link) => (
              <Link key={link.key} href={link.href} className="mv-nav-link">
                {t(link.key)}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="mv-nav-right">
            <LanguageSwitcher />
            <ThemeToggle className="mv-icon-btn" labels={themeLabels} />
            {accountAction('bar')}
          </div>

          {/* Hamburger (mobile) */}
          <button
            ref={menuButtonRef}
            type="button"
            className="mv-icon-btn mv-nav-burger"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
          >
            {mobileOpen ? (
              <X size={22} aria-hidden="true" />
            ) : (
              <Menu size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile sheet: drops in; its links arrive as a list */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('menu')}
          className="mv-nav-sheet mv-enter-down"
        >
          <div className="mv-nav-sheet-inner">
            <div className="mv-nav-sheet-group mv-enter-list">
              {NAV_LINKS.map((link, i) => (
                <Link
                  key={link.key}
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={link.href}
                  onClick={closeMobile}
                  className="mv-nav-sheet-link"
                  style={{ '--i': i } as CSSProperties}
                >
                  {t(link.key)}
                </Link>
              ))}
            </div>
            <div className="mv-nav-sheet-row">
              <LanguageSwitcher />
              <ThemeToggle className="mv-icon-btn" labels={themeLabels} />
            </div>
            <div className="mv-nav-sheet-actions">{accountAction('sheet')}</div>
          </div>
        </div>
      )}
    </>
  );
}
