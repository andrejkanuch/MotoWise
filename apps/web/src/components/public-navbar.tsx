'use client';

import { palette } from '@motovault/design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const NAV_LINKS = [
  { label: 'Explore', href: '/explore' },
  { label: 'Compare', href: '/compare' },
] as const;

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const scrolledRef = useRef(false);

  const onScroll = useCallback(() => {
    const y = window.scrollY;
    if (!scrolledRef.current && y > 80) {
      scrolledRef.current = true;
      setScrolled(true);
    } else if (scrolledRef.current && y < 20) {
      scrolledRef.current = false;
      setScrolled(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  // Check auth state
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  return (
    <header
      className="sticky top-0 z-50 transition-colors duration-200"
      style={{
        backgroundColor:
          scrolled || menuOpen ? 'var(--color-surface, rgba(10,10,10,0.95))' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled || menuOpen ? 'blur(12px)' : 'none',
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <a href="/" className="flex items-center gap-1.5">
          <span className="text-lg font-bold tracking-tight text-[--color-on-surface]">
            Moto<span style={{ color: palette.signature400 }}>Vault</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[--color-on-surface-muted] transition-colors hover:text-[--color-on-surface]"
            >
              {link.label}
            </a>
          ))}
          {isLoggedIn === true ? (
            <a
              href="/garage"
              className="text-sm font-medium text-[--color-on-surface] transition-colors hover:opacity-80"
            >
              My Garage
            </a>
          ) : isLoggedIn === false ? (
            <a
              href="/login"
              className="text-sm text-[--color-on-surface-muted] transition-colors hover:text-[--color-on-surface]"
            >
              Sign in
            </a>
          ) : null}
          <a
            href="https://apps.apple.com/us/app/motovault/id6760291360"
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: palette.signature500, color: palette.white }}
          >
            Get the App
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="-mr-2 p-3 text-[--color-on-surface-muted] sm:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <title>Close</title>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <title>Menu</title>
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-[--color-border] px-4 pb-4 sm:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2.5 text-sm text-[--color-on-surface-muted]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {isLoggedIn === true ? (
            <a
              href="/garage"
              className="block py-2.5 text-sm font-medium text-[--color-on-surface]"
              onClick={() => setMenuOpen(false)}
            >
              My Garage
            </a>
          ) : isLoggedIn === false ? (
            <a
              href="/login"
              className="block py-2.5 text-sm text-[--color-on-surface-muted]"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </a>
          ) : null}
          <a
            href="https://apps.apple.com/us/app/motovault/id6760291360"
            className="mt-2 block rounded-lg px-4 py-2.5 text-center text-sm font-medium"
            style={{ backgroundColor: palette.signature500, color: palette.white }}
          >
            Get the App
          </a>
        </div>
      )}
    </header>
  );
}
