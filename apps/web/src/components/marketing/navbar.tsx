'use client';

import { BookOpen, Camera, ChevronDown, Map as MapIcon, Menu, Warehouse, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link, usePathname } from '@/i18n/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LanguageSwitcher } from './language-switcher';

/* ── Features dropdown: label + one-line subtitle, both from i18n ── */
const FEATURE_ITEMS = [
  {
    key: 'tripPlanning',
    subKey: 'tripPlanningSub',
    href: '/features/trip-planning',
    Icon: MapIcon,
  },
  { key: 'diagnostics', subKey: 'diagnosticsSub', href: '/features/ai-diagnostics', Icon: Camera },
  { key: 'garage', subKey: 'garageSub', href: '/features/garage-management', Icon: Warehouse },
  { key: 'learning', subKey: 'learningSub', href: '/features/learning-paths', Icon: BookOpen },
] as const;

const NAV_LINKS = [
  { key: 'explore', href: '/explore' },
  { key: 'faq', href: '/#faq' },
  { key: 'pro', href: '/pro' },
] as const;

const SCROLL_ACTIVATE = 80;
const SCROLL_DEACTIVATE = 20;
const DROPDOWN_CLOSE_DELAY_MS = 80;
const FEATURES_KEY = 'features';

/*
 * The bar is flat on the ramp. Transparent at the top of the page; once
 * scrolled it sits on the raised glass step with the site's ONE backdrop
 * blur (12px). Its children sit in a 1240 inner container so the wordmark
 * shares the left edge with every section's H1 on wide viewports. design-system.css keys the light-scheme hero overrides on
 * `.mv-navbar[data-scrolled]` / `.mv-navbar:not([data-scrolled])`, so the
 * open mobile sheet also sets data-scrolled: it leaves the dark hero scene
 * and sits on the same ground as the sheet (opaque, no blur).
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
  transition: background .3s var(--mv-ease), border-color .3s var(--mv-ease), padding .3s var(--mv-ease);
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
  cursor: pointer;
  transition: color .15s, background .15s;
}
.mv-nav-link:hover,
.mv-nav-link[aria-expanded="true"] {
  color: var(--mv-ink);
  background: var(--mv-fill);
}
.mv-nav-link svg {
  color: var(--mv-ink-3);
  transition: transform .2s var(--mv-ease);
}
.mv-nav-link[aria-expanded="true"] svg {
  transform: rotate(180deg);
}
.mv-nav-dropdown {
  position: relative;
}
/* A hover bridge so the pointer can cross the gap to the menu */
.mv-nav-dropdown::after {
  content: "";
  position: absolute;
  top: 100%; left: -16px; right: -16px;
  height: 12px;
}
/* One step up the ramp: surface-2, hairline, card radius, no shadow */
.mv-nav-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 300px;
  padding: 8px;
  background: var(--mv-surface-2);
  border: 1px solid var(--mv-line);
  border-radius: var(--mv-radius-card);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity .18s var(--mv-ease), transform .18s var(--mv-ease), visibility .18s;
}
.mv-nav-menu[data-open] {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.mv-nav-item {
  display: grid;
  grid-template-columns: 18px 1fr;
  column-gap: 12px;
  align-items: start;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: var(--mv-radius-control);
  color: var(--mv-ink);
  text-decoration: none;
  transition: background .15s;
}
.mv-nav-item:hover {
  background: var(--mv-surface-3);
}
.mv-nav-item svg {
  margin-top: 2px;
  color: var(--mv-ink-3);
}
.mv-nav-item-title {
  display: block;
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
}
.mv-nav-item-sub {
  display: block;
  margin-top: 1px;
  font-size: 13px;
  line-height: 18px;
  color: var(--mv-ink-3);
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
/* Mobile sheet: full height on the ground, no blur */
.mv-nav-sheet {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  flex-direction: column;
  padding-top: 72px;
  background: var(--mv-bg);
  font-family: var(--mv-font-body);
  color: var(--mv-ink);
}
.mv-nav-sheet-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 24px calc(24px + env(safe-area-inset-bottom));
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
.mv-nav-sheet-link svg {
  color: var(--mv-ink-3);
}
.mv-nav-sheet-link-sub {
  display: block;
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  color: var(--mv-ink-3);
}
.mv-nav-sheet-small .mv-nav-sheet-link {
  font-size: 17px;
  min-height: 48px;
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
@media (max-width: 900px) {
  .mv-navbar, .mv-navbar[data-scrolled] { padding-left: 24px; padding-right: 24px; }
  .mv-nav-links, .mv-nav-right { display: none; }
  .mv-nav-burger { display: inline-flex; }
}
@media (max-width: 480px) {
  .mv-navbar, .mv-navbar[data-scrolled] { padding-left: 20px; padding-right: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .mv-navbar, .mv-navbar * { transition-duration: 0.01ms !important; }
}
`;

export function Navbar() {
  const pathname = usePathname();
  const t = useTranslations('Navbar');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const scrolledRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Focus first link when mobile menu opens
  useEffect(() => {
    if (mobileOpen) {
      firstLinkRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const handleDropdownEnter = useCallback(() => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setDropdownOpen(true);
  }, []);

  const handleDropdownLeave = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => setDropdownOpen(false), DROPDOWN_CLOSE_DELAY_MS);
  }, []);

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const menu = dropdownMenuRef.current;
      if (!menu) return;
      const items = menu.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]');
      if (!items.length) return;
      const focused = document.activeElement as HTMLElement;
      const idx = Array.from(items).indexOf(focused as HTMLAnchorElement);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!dropdownOpen) {
            setDropdownOpen(true);
            requestAnimationFrame(() => items[0]?.focus());
          } else {
            items[idx + 1 < items.length ? idx + 1 : 0]?.focus();
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (dropdownOpen) {
            items[idx - 1 >= 0 ? idx - 1 : items.length - 1]?.focus();
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setDropdownOpen(false);
          dropdownTriggerRef.current?.focus();
          break;
        }
        case 'Tab': {
          setDropdownOpen(false);
          break;
        }
      }
    },
    [dropdownOpen],
  );

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
            {/* biome-ignore lint/a11y/noStaticElementInteractions: dropdown hover container */}
            <div
              className="mv-nav-dropdown"
              onMouseEnter={handleDropdownEnter}
              onMouseLeave={handleDropdownLeave}
              onFocus={handleDropdownEnter}
              onBlur={handleDropdownLeave}
              onKeyDown={handleDropdownKeyDown}
            >
              <button
                ref={dropdownTriggerRef}
                type="button"
                className="mv-nav-link"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen((open) => !open)}
              >
                {t(FEATURES_KEY)}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              <div
                ref={dropdownMenuRef}
                role="menu"
                className="mv-nav-menu"
                data-open={dropdownOpen ? 'true' : undefined}
              >
                {FEATURE_ITEMS.map(({ key, subKey, href, Icon }) => (
                  <Link key={key} href={href} role="menuitem" className="mv-nav-item">
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span>
                      <span className="mv-nav-item-title">{t(key)}</span>
                      <span className="mv-nav-item-sub">{t(subKey)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

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

      {/* Mobile sheet */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('menu')}
          className="mv-nav-sheet"
        >
          <div className="mv-nav-sheet-inner">
            <div className="mv-nav-sheet-group">
              {FEATURE_ITEMS.map(({ key, subKey, href, Icon }, i) => (
                <Link
                  key={key}
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={href}
                  onClick={closeMobile}
                  className="mv-nav-sheet-link"
                >
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span>
                    {t(key)}
                    <span className="mv-nav-sheet-link-sub">{t(subKey)}</span>
                  </span>
                </Link>
              ))}
            </div>
            <div className="mv-nav-sheet-group mv-nav-sheet-small">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={closeMobile}
                  className="mv-nav-sheet-link"
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
