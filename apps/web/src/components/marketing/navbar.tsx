'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LanguageSwitcher } from './language-switcher';

type NavLeaf = { key: string; href: string; tagline?: string };
type NavGroup = { key: string; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;

const isGroup = (item: NavItem): item is NavGroup => 'children' in item;

const NAV_LINKS: readonly NavItem[] = [
  {
    key: 'features',
    children: [
      {
        key: 'tripPlanning',
        href: '/features/trip-planning',
        tagline: 'Multi-day routes, typed waypoints, live map',
      },
      {
        key: 'diagnostics',
        href: '/features/ai-diagnostics',
        tagline: 'Snap a photo, get an AI-powered diagnosis',
      },
      {
        key: 'garage',
        href: '/features/garage-management',
        tagline: 'Every bike, every service, one timeline',
      },
      {
        key: 'learning',
        href: '/features/learning-paths',
        tagline: 'Modules tailored to your motorcycle',
      },
      {
        key: 'progress',
        href: '/features/progress-tracking',
        tagline: 'Rides, tasks and spend logged automatically',
      },
    ],
  },
  { key: 'explore', href: '/explore' },
  { key: 'compare', href: '/compare' },
  { key: 'faq', href: '#faq' },
] as const;

const SCROLL_ACTIVATE = 80;
const SCROLL_DEACTIVATE = 20;

export function Navbar() {
  const pathname = usePathname();
  const t = useTranslations('Navbar');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter,filter] duration-300 ${
        scrolled
          ? 'border-b border-warm-500/20 bg-neutral-950/60 saturate-150 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div
        className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="logo-glow logo-needle text-xl font-extrabold tracking-tight text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:rounded"
        >
          MotoVault
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-5 xl:gap-7 lg:flex">
          {NAV_LINKS.map((item) => {
            const cls =
              'text-sm text-neutral-300 underline-offset-4 transition-colors hover:text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:rounded min-h-[44px] inline-flex items-center';

            if (isGroup(item)) {
              return (
                <div key={item.key} className="nav-dropdown group relative">
                  <button
                    type="button"
                    className={`${cls} gap-1`}
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    {t(item.key)}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-200 group-hover:rotate-180"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div
                    role="menu"
                    className="pointer-events-none absolute left-1/2 top-full z-50 w-[340px] -translate-x-1/2 translate-y-0 pt-3 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                  >
                    <div className="overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-950/95 shadow-2xl ring-1 ring-neutral-800 backdrop-blur-xl">
                      <ul className="p-2">
                        {item.children.map((child) => (
                          <li key={child.key}>
                            <Link
                              href={child.href}
                              role="menuitem"
                              className="flex flex-col gap-0.5 rounded-xl px-4 py-3 text-left transition-colors hover:bg-neutral-900 focus-visible:bg-neutral-900 focus-visible:outline-none"
                            >
                              <span className="text-sm font-semibold text-neutral-50">
                                {t(child.key)}
                              </span>
                              {child.tagline && (
                                <span className="text-xs text-neutral-500">{child.tagline}</span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-neutral-900 px-4 py-3">
                        <Link
                          href="/features"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-warm-400 transition-colors hover:text-warm-300"
                        >
                          {t('viewAllFeatures', { defaultValue: 'View all features' })}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return item.href.startsWith('#') ? (
              <a key={item.key} href={item.href} className={cls}>
                {t(item.key)}
              </a>
            ) : (
              <Link key={item.key} href={item.href} className={cls}>
                {t(item.key)}
              </Link>
            );
          })}
          <LanguageSwitcher />
          {isLoggedIn ? (
            <a
              href="/feed"
              className="cta-primary rounded-full bg-warm-500 px-5 py-2.5 text-sm font-bold text-neutral-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              {t('dashboard', { defaultValue: 'My Garage' })}
            </a>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-neutral-800/80 bg-neutral-900/40 p-1 backdrop-blur-sm">
              <a
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                {t('login', { defaultValue: 'Log In' })}
              </a>
              <a
                href="/signup"
                className="cta-primary rounded-full bg-warm-500 px-4 py-2 text-sm font-bold text-neutral-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                {t('signup', { defaultValue: 'Sign Up' })}
              </a>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          ref={menuButtonRef}
          type="button"
          className="flex size-11 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:text-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 lg:hidden"
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
          className="fixed inset-0 z-40 flex flex-col bg-neutral-950/95 backdrop-blur-xl lg:hidden"
          style={{ top: 'calc(72px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-8">
            {(() => {
              // Flatten dropdown children into top-level for mobile menu
              const mobileItems: NavLeaf[] = [];
              for (const item of NAV_LINKS) {
                if (isGroup(item)) {
                  for (const child of item.children) mobileItems.push(child);
                } else {
                  mobileItems.push(item);
                }
              }
              return mobileItems.map((link, i) => {
                const cls =
                  'text-2xl font-medium text-neutral-200 underline-offset-4 transition-colors hover:text-neutral-50 hover:underline';
                return link.href.startsWith('#') ? (
                  <a
                    key={link.key}
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={link.href}
                    onClick={closeMobile}
                    className={cls}
                  >
                    {t(link.key)}
                  </a>
                ) : (
                  <Link
                    key={link.key}
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={link.href}
                    onClick={closeMobile}
                    className={cls}
                  >
                    {t(link.key)}
                  </Link>
                );
              });
            })()}
            <LanguageSwitcher />
            {isLoggedIn ? (
              <a
                href="/feed"
                onClick={closeMobile}
                className="cta-primary mt-4 rounded-full bg-warm-500 px-10 py-4 text-lg font-bold text-neutral-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                {t('dashboard', { defaultValue: 'My Garage' })}
              </a>
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 p-1.5 backdrop-blur-sm">
                <a
                  href="/login"
                  onClick={closeMobile}
                  className="rounded-full px-6 py-3 text-base font-medium text-neutral-300 transition-colors hover:text-neutral-50"
                >
                  {t('login', { defaultValue: 'Log In' })}
                </a>
                <a
                  href="/signup"
                  onClick={closeMobile}
                  className="cta-primary rounded-full bg-warm-500 px-6 py-3 text-base font-bold text-neutral-950 transition-opacity hover:opacity-90"
                >
                  {t('signup', { defaultValue: 'Sign Up' })}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
