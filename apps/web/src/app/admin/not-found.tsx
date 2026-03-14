import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <h1 className="text-6xl font-bold text-neutral-50">404</h1>
      <p className="text-neutral-400">This admin page does not exist.</p>
      <Link
        href="/admin"
        className="mt-2 text-primary-400 hover:text-primary-300 transition-colors no-underline"
      >
        Back to Admin
      </Link>
    </div>
  );
}
