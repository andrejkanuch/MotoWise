import type { Metadata } from 'next';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = {
  title: 'Admin',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[--color-surface] dark:bg-neutral-900">
      <nav className="w-60 p-4 border-r border-[--color-border] dark:border-neutral-700 flex flex-col bg-[--color-surface-elevated] dark:bg-neutral-800">
        <h2 className="text-lg font-bold text-[--color-on-surface] dark:text-neutral-50 mb-4">
          MotoVault Admin
        </h2>
        <ul className="list-none p-0 flex-1 space-y-1">
          <li>
            <Link
              href="/admin"
              className="block px-3 py-2 rounded-[--radius-button] text-[--color-on-surface] dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline"
            >
              Overview
            </Link>
          </li>
          <li>
            <Link
              href="/admin/articles"
              className="block px-3 py-2 rounded-[--radius-button] text-[--color-on-surface] dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline"
            >
              Articles
            </Link>
          </li>
          <li>
            <Link
              href="/admin/users"
              className="block px-3 py-2 rounded-[--radius-button] text-[--color-on-surface] dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline"
            >
              Users
            </Link>
          </li>
          <li>
            <Link
              href="/admin/diagnostics"
              className="block px-3 py-2 rounded-[--radius-button] text-[--color-on-surface] dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline"
            >
              Diagnostics
            </Link>
          </li>
          <li>
            <Link
              href="/admin/flags"
              className="block px-3 py-2 rounded-[--radius-button] text-[--color-on-surface] dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors no-underline"
            >
              Content Flags
            </Link>
          </li>
        </ul>
        <SignOutButton />
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
