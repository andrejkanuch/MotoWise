import Link from 'next/link';

interface TripCardProps {
  slug: string;
  name?: string;
}

/**
 * A styled link card for embedding trip references in MDX guides.
 * Renders as a static link — no GraphQL calls during MDX compilation.
 */
export function TripCard({ slug, name }: TripCardProps) {
  const displayName = name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Link
      href={`/trips/${slug}`}
      className="my-4 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-amber-500/40 hover:bg-neutral-900/80"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-lg">
        {'\u{1F3CD}'}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-100">{displayName}</span>
        <span className="block text-xs text-neutral-500">View trip details on MotoVault</span>
      </div>
      <span className="shrink-0 text-sm text-amber-400">&rarr;</span>
    </Link>
  );
}
