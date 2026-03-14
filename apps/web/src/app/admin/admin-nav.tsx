'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignOutButton } from './sign-out-button';

const navLinks = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/diagnostics', label: 'Diagnostics' },
  { href: '/admin/flags', label: 'Content Flags' },
];

const linkClassName =
  'block px-3 py-2 rounded-[--radius-button] text-neutral-200 hover:bg-neutral-800 transition-colors no-underline';

export function AdminNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-3 p-3 border-b border-neutral-800 bg-neutral-900">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-md hover:bg-neutral-800 transition-colors"
          aria-label="Open menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <span className="text-sm font-bold text-neutral-50">MotoVault Admin</span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismisses overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            role="presentation"
          />
          <nav className="absolute top-0 left-0 bottom-0 w-60 p-4 flex flex-col bg-neutral-900 shadow-lg z-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-50">MotoVault Admin</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-neutral-800 transition-colors"
                aria-label="Close menu"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            <ul className="list-none p-0 flex-1 space-y-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <SignOutButton />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-60 p-4 border-r border-neutral-800 bg-neutral-900">
        <h2 className="text-lg font-bold text-neutral-50 mb-4">MotoVault Admin</h2>
        <ul className="list-none p-0 flex-1 space-y-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={linkClassName}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <SignOutButton />
      </nav>
    </>
  );
}
