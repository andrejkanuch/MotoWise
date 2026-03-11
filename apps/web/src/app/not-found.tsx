import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center bg-neutral-950 text-neutral-50">
      <h1 className="text-6xl font-extrabold tracking-tight">404</h1>
      <p className="text-lg text-neutral-400">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="rounded-full bg-warm-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-opacity hover:opacity-90"
      >
        Back to Home
      </Link>
    </div>
  );
}
