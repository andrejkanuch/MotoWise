import type { Metadata } from 'next';
import { SharedTripView } from '@/components/shared-trip-view';
import { fetchTripByToken } from '@/lib/fetch-trip-by-token';

export const dynamic = 'force-dynamic';

/**
 * Metadata is intentionally generic — we MUST NOT leak any trip-specific
 * data (title, description, cover image) into the OG preview because share
 * links are semi-public and may land in link-unfurlers or crawlers. The
 * teaser copy is static; robots are explicitly disabled.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'A trip shared from MotoVault',
    description: 'Open it in the app to see the plan, the waypoints and who is going.',
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
    openGraph: {
      title: 'A trip shared from MotoVault',
      description: 'Open it in the app to see the plan.',
      images: [{ url: '/og/trip-teaser.png' }],
    },
  };
}

export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  // Next.js 16 — `params` is async.
  const { token } = await params;
  const data = await fetchTripByToken(token);
  return <SharedTripView data={data} />;
}
