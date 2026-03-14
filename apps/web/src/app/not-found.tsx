import Link from 'next/link';

// Root-level not-found.tsx has no access to the [locale] segment,
// so next-intl translations are unavailable here. Strings are hardcoded in English.
// See: https://next-intl.dev/docs/environments/error-files
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center bg-neutral-950 text-neutral-50">
      {/* Speedometer needle pointing to 404 */}
      <div className="relative flex size-40 items-center justify-center">
        <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
          {/* Gauge arc */}
          <path
            d="M20 90 A50 50 0 1 1 100 90"
            fill="none"
            stroke="oklch(0.27 0 0)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Copper accent arc (partial) */}
          <path
            d="M20 90 A50 50 0 0 1 40 28"
            fill="none"
            stroke="oklch(0.60 0.16 45)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Needle */}
          <line
            x1="60"
            y1="60"
            x2="38"
            y2="30"
            stroke="oklch(0.60 0.16 45)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="5" fill="oklch(0.60 0.16 45)" />
        </svg>
      </div>

      <div>
        <h1 className="text-7xl font-extrabold tracking-tight text-warm-400">404</h1>
        <p className="mt-3 text-xl text-neutral-400">Wrong turn. This road doesn&apos;t exist.</p>
      </div>

      <Link
        href="/"
        className="cta-primary rounded-full bg-warm-500 px-8 py-3 font-semibold text-neutral-950"
      >
        Ride back home
      </Link>
    </div>
  );
}
