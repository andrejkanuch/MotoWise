import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[--color-on-surface] dark:text-neutral-50">404</h1>
      <p className="mt-2 text-[--color-on-surface-muted] dark:text-neutral-300">
        This admin page does not exist.
      </p>
      <Link
        href="/admin"
        className="mt-4 inline-block text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors no-underline"
      >
        Back to Admin
      </Link>
    </div>
  );
}
