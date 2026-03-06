import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[--color-surface] dark:bg-neutral-900">
      <h1 className="text-4xl font-bold text-[--color-on-surface] dark:text-neutral-50">404</h1>
      <p className="text-[--color-on-surface-muted] dark:text-neutral-300">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 bg-primary-500 text-white rounded-[--radius-button] no-underline hover:bg-primary-600 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
