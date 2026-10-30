import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { GetAppLink } from '@/components/open-in-app-link';
import { ShareUnavailable } from '@/components/share-unavailable';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { fetchRide } from '@/lib/fetch-ride';
import { formatDate, formatDistance, formatDuration } from '@/lib/format-utils';
import { settleUpstream } from '@/lib/upstream-error';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ride = await settleUpstream(fetchRide(id));
  if (ride === undefined) return { title: 'MotoVault ride', robots: { index: false } };
  if (!ride) return { title: 'Ride not found' };

  const title = ride.name ?? 'MotoVault ride';
  const description = `${formatDistance(ride.distanceM ?? 0)} ride tracked with MotoVault`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `https://motovault.app/ride/${ride.id}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://motovault.app/ride/${ride.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/** "412.3 km" → ["412.3", "km"] so the unit can sit small beside the figure. */
function splitUnit(value: string): [string, string | null] {
  const match = value.match(/^(.*?)\s*([a-z%]+)$/i);
  return match ? [match[1], match[2]] : [value, null];
}

export default async function RidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // undefined = the API never answered (outage), null = no such public ride
  const ride = await settleUpstream(fetchRide(id));

  if (ride === undefined) {
    return <ShareUnavailable what="The ride" path={`/ride/${id}`} />;
  }
  if (!ride) {
    notFound();
  }

  const figures: Array<{ label: string; value: string }> = [
    { label: 'Distance', value: formatDistance(ride.distanceM ?? 0) },
  ];
  if (ride.durationS != null && ride.durationS > 0) {
    figures.push({ label: 'Moving time', value: formatDuration(ride.durationS) });
  }
  if ((ride.elevationGain ?? 0) > 0) {
    figures.push({ label: 'Climb', value: `${Math.round(ride.elevationGain ?? 0)} m` });
  }
  if ((ride.elevationLoss ?? 0) > 0) {
    figures.push({ label: 'Descent', value: `${Math.round(ride.elevationLoss ?? 0)} m` });
  }

  return (
    <div className="mv-marketing sp">
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      {ride.routeThumbnailUri ? (
        <div className="sp-photo">
          {/* biome-ignore lint/performance/noImgElement: route thumbnail from Supabase storage */}
          <img src={ride.routeThumbnailUri} alt="Map of the route" />
        </div>
      ) : null}

      <main className={`sp-main${ride.routeThumbnailUri ? '' : ' sp-main-tall'}`}>
        <h1 className="mv-section-title sp-title">{ride.name ?? 'MotoVault ride'}</h1>
        <p className="sp-sub">{formatDate(ride.startedAt)} · A ride recorded with MotoVault</p>

        <div className="sp-figures">
          {figures.map(({ label, value }) => {
            const [num, unit] = splitUnit(value);
            return (
              <div className="sp-figure" key={label}>
                <span className="mv-figure sp-figure-value">
                  {num}
                  {unit && <small>{unit}</small>}
                </span>
                <span className="sp-figure-label">{label}</span>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="sp-cta">
        <div className="sp-cta-inner">
          <h2 className="mv-h2">See the full ride in MotoVault</h2>
          <p className="sp-cta-sub">
            The route, speed and elevation, the bike it was ridden on, and every ride before it.
          </p>
          <div className="sp-cta-actions">
            <GetAppLink
              pageType={CtaPageType.Ride}
              placement={CtaPlacement.Footer}
              slug={ride.id}
              className="mv-btn mv-btn-primary"
            >
              Get the app
            </GetAppLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
