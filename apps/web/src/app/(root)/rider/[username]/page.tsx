import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { StoreLink } from '@/components/marketing/store-buttons';
import { ShareUnavailable } from '@/components/share-unavailable';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { fetchProfile } from '@/lib/fetch-profile';
import { formatDistance } from '@/lib/format-utils';
import { settleUpstream } from '@/lib/upstream-error';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

// Rendered per request, like /t: an API outage shows ShareUnavailable, and that
// page must never be cached over a good copy. The fetch itself is still cached
// in the data cache, so the API sees at most one call per revalidate window.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await settleUpstream(fetchProfile(username));
  if (profile === undefined) return { title: 'Rider profile', robots: { index: false } };
  if (!profile) return { title: 'Rider not found' };

  const description = profile.bio
    ? profile.bio.slice(0, 155)
    : `${profile.displayName ?? profile.publicUsername} rides with MotoVault. ${profile.rideStats.totalRides} rides logged.`;

  return {
    title: `${profile.displayName ?? profile.publicUsername} (@${profile.publicUsername})`,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `https://motovault.app/rider/${profile.publicUsername}` },
    openGraph: {
      title: `${profile.displayName ?? profile.publicUsername} (@${profile.publicUsername})`,
      description,
      type: 'profile',
      url: `https://motovault.app/rider/${profile.publicUsername}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${profile.displayName ?? profile.publicUsername} (@${profile.publicUsername})`,
      description,
    },
  };
}

function formatJoinDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
  });
}

/** "1.2k km" → ["1.2k", "km"] so the unit sits small beside the figure. */
function splitUnit(value: string): [string, string | null] {
  const match = value.match(/^(.*?)\s*([a-z%]+)$/i);
  return match ? [match[1], match[2]] : [value, null];
}

export default async function RiderProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // undefined = the API never answered (outage), null = no such rider
  const profile = await settleUpstream(fetchProfile(username));

  if (profile === undefined) {
    return <ShareUnavailable what="The rider's profile" path={`/rider/${username}`} />;
  }
  if (!profile) {
    notFound();
  }

  const displayName = profile.displayName ?? profile.publicUsername;
  const initial = displayName.charAt(0).toUpperCase();
  const [distanceNum, distanceUnit] = splitUnit(formatDistance(profile.rideStats.totalDistance));
  const meta = [`@${profile.publicUsername}`, profile.city].filter(Boolean).join(' · ');

  return (
    <div className="mv-marketing sp">
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      <main className="sp-main sp-main-tall">
        <header className="sp-header">
          {profile.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
            <img src={profile.avatarUrl} alt="" className="sp-avatar" />
          ) : (
            <div className="sp-avatar" aria-hidden="true">
              {initial}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="mv-section-title sp-title">{displayName}</h1>
            <p className="sp-sub">{meta}</p>
          </div>
        </header>

        {profile.bio && (
          <p className="sp-prose" style={{ marginTop: 24 }}>
            {profile.bio}
          </p>
        )}

        <div className="sp-figures">
          <div className="sp-figure">
            <span className="mv-figure sp-figure-value">{profile.rideStats.totalRides}</span>
            <span className="sp-figure-label">Rides logged</span>
          </div>
          <div className="sp-figure">
            <span className="mv-figure sp-figure-value">
              {distanceNum}
              {distanceUnit && <small>{distanceUnit}</small>}
            </span>
            <span className="sp-figure-label">Distance ridden</span>
          </div>
        </div>

        {profile.bikes.length > 0 && (
          <section className="sp-section">
            <h2 className="sp-section-title">Garage</h2>
            <ul className="mv-rows">
              {profile.bikes.map((bike) => (
                <li key={`${bike.year}-${bike.make}-${bike.model}`} className="mv-row sp-row">
                  <div className="sp-row-body">
                    <div className="sp-row-title">
                      {bike.nickname ?? `${bike.year} ${bike.make} ${bike.model}`}
                    </div>
                    {bike.nickname && (
                      <div className="sp-row-meta">
                        {bike.year} {bike.make} {bike.model}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.rideStats.joinDate && (
          <p className="sp-foot-note">
            Riding with MotoVault since {formatJoinDate(profile.rideStats.joinDate)}
          </p>
        )}
      </main>

      <footer className="sp-cta">
        <div className="sp-cta-inner">
          <h2 className="mv-h2">Keep your own logbook</h2>
          <p className="sp-cta-sub">
            Every ride, every service, every cost, for each bike you own. Free to start.
          </p>
          <div className="sp-cta-actions">
            <StoreLink
              platform={StorePlatform.Ios}
              pageType={CtaPageType.Rider}
              placement={CtaPlacement.Footer}
              slug={username}
              className="mv-btn mv-btn-primary"
            >
              Download for iOS
            </StoreLink>
            <StoreLink
              platform={StorePlatform.Android}
              pageType={CtaPageType.Rider}
              placement={CtaPlacement.Footer}
              slug={username}
              className="mv-btn mv-btn-ghost"
            >
              Download for Android
            </StoreLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
