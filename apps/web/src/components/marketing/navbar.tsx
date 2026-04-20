'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LanguageSwitcher } from './language-switcher';

/* ── Dropdown feature items with icons ── */
const FEATURE_ITEMS = [
  {
    key: 'tripPlanning',
    href: '/features/trip-planning',
    sub: 'Multi-day routes & GPX export.',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    key: 'diagnostics',
    href: '/features/ai-diagnostics',
    sub: 'Snap a photo, get the answer.',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    key: 'garage',
    href: '/features/garage-management',
    sub: 'Unlimited bikes, one vault.',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: 'learning',
    href: '/features/learning-paths',
    sub: 'Go from novice to expert.',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
] as const;

const NAV_LINKS = [
  { key: 'explore', href: '/explore' },
  { key: 'riders', href: '#proof' },
  { key: 'faq', href: '#faq' },
] as const;

const SCROLL_ACTIVATE = 80;
const SCROLL_DEACTIVATE = 20;

/* ── Styles ── */
const S = {
  nav: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition:
      'padding .4s var(--mv-ease), background .4s var(--mv-ease), backdrop-filter .4s var(--mv-ease), border-color .4s',
    borderBottom: '1px solid transparent',
  },
  navScrolled: {
    padding: '12px 40px',
    background: 'oklch(0.09 0.008 55 / 0.7)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    borderBottomColor: 'var(--mv-line)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontWeight: 600,
    fontSize: '17px',
    letterSpacing: '-0.02em',
    color: 'var(--mv-ink)',
    textDecoration: 'none',
  },
  brandMark: {
    width: '32px',
    height: '32px',
    borderRadius: '9px',
    overflow: 'hidden' as const,
    display: 'grid',
    placeItems: 'center',
    transition: 'transform .5s var(--mv-ease-expo)',
  },
  brandMarkHover: {
    transform: 'rotate(-8deg) scale(1.05)',
  },
  brandImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  navLinks: {
    display: 'flex',
    gap: '2px',
    alignItems: 'center',
    padding: '4px',
    background: 'oklch(1 0 0 / 0.02)',
    border: '1px solid var(--mv-line)',
    borderRadius: '999px',
    backdropFilter: 'blur(12px)',
    position: 'relative' as const,
  },
  navLink: {
    color: 'var(--mv-ink-2)',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
    padding: '9px 16px',
    borderRadius: '999px',
    transition: 'color .2s, background .2s',
    letterSpacing: '-0.005em',
    position: 'relative' as const,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    fontFamily: 'inherit',
  },
  navLinkHover: {
    color: 'var(--mv-ink)',
    background: 'oklch(1 0 0 / 0.04)',
  },
  dropdown: {
    position: 'relative' as const,
  },
  dropdownTrigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
  },
  dropdownMenu: {
    position: 'absolute' as const,
    top: 'calc(100% + 10px)',
    left: '50%',
    transform: 'translateX(-50%) translateY(-8px)',
    minWidth: '340px',
    background: 'oklch(0.12 0.01 55 / 0.96)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    border: '1px solid var(--mv-line)',
    borderRadius: '18px',
    padding: '10px',
    opacity: 0,
    visibility: 'hidden' as const,
    transition: 'opacity .3s var(--mv-ease), transform .3s var(--mv-ease), visibility .3s',
    boxShadow: '0 40px 80px -20px oklch(0 0 0 / 0.7)',
  },
  dropdownMenuOpen: {
    opacity: 1,
    visibility: 'visible' as const,
    transform: 'translateX(-50%) translateY(0)',
  },
  dropdownBridge: {
    content: '""',
    position: 'absolute' as const,
    top: '100%',
    left: '-20px',
    right: '-20px',
    height: '14px',
  },
  dropdownItem: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    padding: '12px 14px',
    borderRadius: '12px',
    color: 'var(--mv-ink)',
    textDecoration: 'none',
    transition: 'background .2s',
  },
  dropdownItemHover: {
    background: 'oklch(1 0 0 / 0.04)',
  },
  dropdownIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'oklch(1 0 0 / 0.04)',
    border: '1px solid var(--mv-line)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--mv-warm-400)',
    flexShrink: 0,
  },
  dropdownTitle: {
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  dropdownSub: {
    fontSize: '12px',
    color: 'var(--mv-ink-3)',
    marginTop: '2px',
    letterSpacing: '-0.005em',
    lineHeight: 1.35,
  },
  navRight: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  navSignin: {
    color: 'var(--mv-ink-2)',
    fontSize: '13px',
    fontWeight: 500,
    textDecoration: 'none',
    padding: '9px 14px',
    transition: 'color .2s',
  },
  navCta: {
    padding: '9px 16px',
    borderRadius: '999px',
    whiteSpace: 'nowrap' as const,
    background: 'var(--mv-ink)',
    color: 'oklch(0.15 0.02 55)',
    fontWeight: 600,
    fontSize: '13px',
    textDecoration: 'none',
    transition: 'transform .2s var(--mv-ease), background .2s',
    letterSpacing: '-0.005em',
    display: 'inline-block',
  },
  navCtaHover: {
    background: 'var(--mv-warm-500)',
    transform: 'translateY(-1px)',
  },
  chevronSvg: {
    transition: 'transform .3s var(--mv-ease)',
    opacity: 0.7,
  },
  chevronOpen: {
    transform: 'rotate(180deg)',
  },
  /* Mobile */
  hamburger: {
    display: 'none',
    width: '44px',
    height: '44px',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: 'var(--mv-ink-2)',
    cursor: 'pointer',
    borderRadius: '12px',
    transition: 'color .2s',
  },
  mobileOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 99,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'oklch(0.09 0.008 55 / 0.96)',
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
  },
  mobileInner: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    overflowY: 'auto' as const,
    padding: '32px 24px',
  },
  mobileLink: {
    fontSize: '24px',
    fontWeight: 500,
    color: 'var(--mv-ink-2)',
    textDecoration: 'none',
    transition: 'color .2s',
    letterSpacing: '-0.02em',
  },
  mobileCta: {
    marginTop: '16px',
    padding: '14px 32px',
    borderRadius: '999px',
    background: 'var(--mv-ink)',
    color: 'oklch(0.15 0.02 55)',
    fontWeight: 600,
    fontSize: '15px',
    textDecoration: 'none',
    transition: 'transform .2s var(--mv-ease), background .2s',
    letterSpacing: '-0.005em',
  },
  mobileSignin: {
    color: 'var(--mv-ink-2)',
    fontSize: '15px',
    fontWeight: 500,
    textDecoration: 'none',
    padding: '9px 14px',
  },
};

export function Navbar() {
  const pathname = usePathname();
  const t = useTranslations('Navbar');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [brandHover, setBrandHover] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [ctaHover, setCtaHover] = useState(false);
  const [signinHover, setSigninHover] = useState(false);
  const [hoveredDropdownItem, setHoveredDropdownItem] = useState<string | null>(null);

  const scrolledRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

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
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
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
    dropdownTimeoutRef.current = setTimeout(() => setDropdownOpen(false), 80);
  }, []);

  return (
    <>
      <nav
        style={{
          ...S.nav,
          ...(scrolled ? S.navScrolled : {}),
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={S.brand}
          onMouseEnter={() => setBrandHover(true)}
          onMouseLeave={() => setBrandHover(false)}
        >
          <span style={{ ...S.brandMark, ...(brandHover ? S.brandMarkHover : {}) }}>
            <Image
              src="/images/marketing/MotoVault.png"
              alt="MotoVault"
              width={32}
              height={32}
              style={S.brandImg}
            />
          </span>
          MotoVault
        </Link>

        {/* Desktop nav-links pill */}
        <div className="mv-nav-links" style={S.navLinks}>
          {/* Features dropdown */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dropdown hover container */}
          <div
            style={S.dropdown}
            onMouseEnter={handleDropdownEnter}
            onMouseLeave={handleDropdownLeave}
            onFocus={handleDropdownEnter}
            onBlur={handleDropdownLeave}
          >
            {/* Bridge element for hover gap */}
            <div style={S.dropdownBridge} />
            <button
              type="button"
              style={{
                ...S.navLink,
                ...S.dropdownTrigger,
                ...(hoveredLink === 'features' || dropdownOpen ? S.navLinkHover : {}),
              }}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              onMouseEnter={() => setHoveredLink('features')}
              onMouseLeave={() => setHoveredLink(null)}
            >
              {t('features')}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
                style={{
                  ...S.chevronSvg,
                  ...(dropdownOpen ? S.chevronOpen : {}),
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div
              role="menu"
              style={{
                ...S.dropdownMenu,
                ...(dropdownOpen ? S.dropdownMenuOpen : {}),
              }}
            >
              {FEATURE_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  role="menuitem"
                  style={{
                    ...S.dropdownItem,
                    ...(hoveredDropdownItem === item.key ? S.dropdownItemHover : {}),
                  }}
                  onMouseEnter={() => setHoveredDropdownItem(item.key)}
                  onMouseLeave={() => setHoveredDropdownItem(null)}
                >
                  <span style={S.dropdownIcon}>{item.icon}</span>
                  <div>
                    <div style={S.dropdownTitle}>{t(item.key)}</div>
                    <div style={S.dropdownSub}>{item.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Explore, Riders, FAQ */}
          {NAV_LINKS.map((link) =>
            link.href.startsWith('#') ? (
              <a
                key={link.key}
                href={link.href}
                style={{
                  ...S.navLink,
                  ...(hoveredLink === link.key ? S.navLinkHover : {}),
                }}
                onMouseEnter={() => setHoveredLink(link.key)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                {t(link.key)}
              </a>
            ) : (
              <Link
                key={link.key}
                href={link.href}
                style={{
                  ...S.navLink,
                  ...(hoveredLink === link.key ? S.navLinkHover : {}),
                }}
                onMouseEnter={() => setHoveredLink(link.key)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                {t(link.key)}
              </Link>
            ),
          )}
        </div>

        {/* Right side */}
        <div className="mv-nav-right" style={S.navRight}>
          <LanguageSwitcher />
          {isLoggedIn ? (
            <a
              href="/feed"
              style={{
                ...S.navCta,
                ...(ctaHover ? S.navCtaHover : {}),
              }}
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => setCtaHover(false)}
            >
              {t('dashboard', { defaultValue: 'My Garage' })}
            </a>
          ) : (
            <>
              <a
                href="/login"
                className="mv-nav-signin"
                style={{
                  ...S.navSignin,
                  ...(signinHover ? { color: 'var(--mv-ink)' } : {}),
                }}
                onMouseEnter={() => setSigninHover(true)}
                onMouseLeave={() => setSigninHover(false)}
              >
                {t('login', { defaultValue: 'Sign in' })}
              </a>
              <a
                href="#download"
                style={{
                  ...S.navCta,
                  ...(ctaHover ? S.navCtaHover : {}),
                }}
                onMouseEnter={() => setCtaHover(true)}
                onMouseLeave={() => setCtaHover(false)}
              >
                {t('getTheApp', { defaultValue: 'Get the app' })}
              </a>
            </>
          )}
        </div>

        {/* Hamburger (mobile) */}
        <button
          ref={menuButtonRef}
          type="button"
          className="mv-hamburger"
          style={S.hamburger}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="8" x2="20" y2="8" />
                <line x1="4" y1="16" x2="20" y2="16" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('openMenu')}
          style={{ ...S.mobileOverlay, top: '72px' }}
        >
          <div style={S.mobileInner}>
            {FEATURE_ITEMS.map((item, i) => (
              <Link
                key={item.key}
                ref={i === 0 ? firstLinkRef : undefined}
                href={item.href}
                onClick={closeMobile}
                style={S.mobileLink}
              >
                {t(item.key)}
              </Link>
            ))}
            {NAV_LINKS.map((link) =>
              link.href.startsWith('#') ? (
                <a key={link.key} href={link.href} onClick={closeMobile} style={S.mobileLink}>
                  {t(link.key)}
                </a>
              ) : (
                <Link key={link.key} href={link.href} onClick={closeMobile} style={S.mobileLink}>
                  {t(link.key)}
                </Link>
              ),
            )}
            <LanguageSwitcher />
            {isLoggedIn ? (
              <a href="/feed" onClick={closeMobile} style={S.mobileCta}>
                {t('dashboard', { defaultValue: 'My Garage' })}
              </a>
            ) : (
              <>
                <a href="/login" onClick={closeMobile} style={S.mobileSignin}>
                  {t('login', { defaultValue: 'Sign in' })}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    ...S.mobileCta,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('getTheApp', { defaultValue: 'Get the app' })}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Responsive styles — hide nav-links + signin at <=960px, show hamburger */}
      <style>{`
        .mv-nav-links, .mv-nav-right .mv-nav-signin { display: flex; }
        .mv-hamburger { display: none !important; }
        @media (max-width: 960px) {
          .mv-nav-links, .mv-nav-right .mv-nav-signin { display: none !important; }
          .mv-nav-right { display: none !important; }
          .mv-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  );
}
