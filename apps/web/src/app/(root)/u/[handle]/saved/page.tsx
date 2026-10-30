import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { fetchProfile } from '@/lib/fetch-profile';
import { fetchSavedTrips } from '@/lib/fetch-saved-routes';
import { settleUpstream } from '@/lib/upstream-error';
import { SavedRouteRow, SavedRoutesClient } from './saved-routes-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await settleUpstream(fetchProfile(handle));
  if (profile === undefined) return { title: 'Saved routes', robots: { index: false } };
  if (!profile) return { title: 'Rider not found' };

  const displayName = profile.displayName ?? profile.publicUsername;
  const title = `Saved routes by ${displayName} (@${profile.publicUsername})`;
  const description = `Motorcycle routes saved by ${displayName} on MotoVault, with distance, climb and surface.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://motovault.app/u/${profile.publicUsername}/saved`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function SavedRoutesPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // The layout above already rendered the outage view when the profile didn't
  // load; this page then renders nothing of its own.
  const profile = await settleUpstream(fetchProfile(handle));

  if (profile === undefined) return null;
  if (!profile) {
    notFound();
  }

  const savedRoutes = await fetchSavedTrips(handle);

  // null = the fetch failed; an empty list is `edges.length === 0` below
  if (!savedRoutes) {
    return (
      <p className="sp-prose" role="alert">
        Saved routes didn&apos;t load.{' '}
        <a href={`/u/${handle}/saved`} className="mv-link">
          Try again
        </a>
        .
      </p>
    );
  }

  const { edges, pageInfo } = savedRoutes;

  if (edges.length === 0) {
    return <EmptyState handle={profile.publicUsername} />;
  }

  return (
    <>
      <div className="sp-section-head">
        <h2 className="sp-section-title">Saved routes</h2>
        <span className="sp-section-count">by @{profile.publicUsername}</span>
      </div>

      <ul className="mv-rows">
        {edges.map(({ node }) => (
          <SavedRouteRow key={node.id} route={node} />
        ))}
      </ul>

      {/* Infinite scroll client component */}
      {pageInfo.hasNextPage && (
        <SavedRoutesClient handle={handle} initialEndCursor={pageInfo.endCursor ?? undefined} />
      )}

      {/* Soft wall for visitors without the app */}
      <SoftWall handle={handle} />
    </>
  );
}

function EmptyState({ handle }: { handle: string }) {
  return (
    <div className="sp-empty">
      <h2 className="sp-section-title">No saved routes yet</h2>
      <p className="sp-prose">@{handle} hasn't saved any routes.</p>
    </div>
  );
}

function SoftWall({ handle }: { handle: string }) {
  return (
    <div className="sp-wall">
      <h2 className="mv-h2">Save routes of your own</h2>
      <p className="sp-cta-sub">
        Browse routes in MotoVault, save the ones you want to ride, and copy them into your planner.
      </p>
      <div className="sp-cta-actions">
        <StoreLink
          platform={StorePlatform.Ios}
          pageType={CtaPageType.Rider}
          placement={CtaPlacement.Inline}
          slug={handle}
          className="mv-btn mv-btn-primary"
        >
          Download for iOS
        </StoreLink>
        <StoreLink
          platform={StorePlatform.Android}
          pageType={CtaPageType.Rider}
          placement={CtaPlacement.Inline}
          slug={handle}
          className="mv-btn mv-btn-ghost"
        >
          Download for Android
        </StoreLink>
      </div>
    </div>
  );
}
