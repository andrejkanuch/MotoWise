'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';

const NAV_LINKS = [
  { key: 'features', href: '#features' },
  { key: 'faq', href: '#faq' },
] as const;

const SCROLL_ACTIVATE = 80;
const SCROLL_DEACTIVATE = 20;

export function Navbar() {
  const pathname = usePathname();
  const t = useTranslations('Navbar');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrolledRef = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Scroll hysteresis — activate at 80px, deactivate at 20px
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

    // Check initial scroll position
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

  // Focus first link when mobile menu opens, restore focus when it closes
  useEffect(() => {
    if (mobileOpen) {
      firstLinkRef.current?.focus();
    } else {
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-warm-500/20 bg-neutral-950/60 saturate-150 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5">
        {/* Logo */}
        <Link href="/" className="logo-glow text-xl font-extrabold tracking-tight text-neutral-50">
          MotoVault
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-neutral-300 underline-offset-4 transition-colors hover:text-neutral-50 hover:underline"
            >
              {t(link.key)}
            </a>
          ))}
          <LanguageSwitcher />
          <a
            href="/login"
            className="text-sm text-neutral-400 transition-colors hover:text-neutral-50"
          >
            {t('login')}
          </a>
          <a
            href="#cta"
            className="cta-primary rounded-full bg-warm-500 px-5 py-2 text-sm font-bold text-neutral-950 transition-opacity hover:opacity-90"
          >
            {t('download')}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          ref={menuButtonRef}
          type="button"
          className="flex size-10 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:text-neutral-50 md:hidden"
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
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('openMenu')}
          className="fixed inset-0 top-[72px] z-40 flex flex-col bg-neutral-950/95 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                onClick={closeMobile}
                className="text-2xl font-medium text-neutral-200 underline-offset-4 transition-colors hover:text-neutral-50 hover:underline"
              >
                {t(link.key)}
              </a>
            ))}
            <LanguageSwitcher />
            {/* biome-ignore lint/a11y/useValidAnchor: anchor with onClick closes mobile menu before navigating */}
            <a
              href="#cta"
              onClick={closeMobile}
              className="cta-primary mt-4 rounded-full bg-warm-500 px-10 py-4 text-lg font-semibold text-neutral-950 transition-opacity hover:opacity-90"
            >
              {t('download')}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
