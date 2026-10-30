import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { fetchProfile } from '../../../../lib/fetch-profile';
import { fetchSavedTrips } from '../../../../lib/fetch-saved-routes';
import { SavedRouteRow, SavedRoutesClient } from './saved-routes-client';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await fetchProfile(handle);
  if (!profile) return { title: 'User Not Found' };

  const displayName = profile.displayName ?? profile.publicUsername;
  const title = `Saved Routes by ${displayName} (@${profile.publicUsername})`;
  const description = `Browse motorcycle routes saved by ${displayName} on MotoVault. Discover scenic rides, twisty roads, and epic adventures.`;

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
  const profile = await fetchProfile(handle);

  if (!profile) {
    notFound();
  }

  const savedRoutes = await fetchSavedTrips(handle);

  if (!savedRoutes) {
    return <EmptyState handle={profile.publicUsername} />;
  }

  const { edges, pageInfo } = savedRoutes;

  if (edges.length === 0) {
    return <EmptyState handle={profile.publicUsername} />;
  }

  return (
    <div className="mv-marketing sp sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-section-title">Saved routes</h2>
        <span className="sp-section-count">by @{profile.publicUsername}</span>
      </div>

      <ul className="sp-list">
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
    </div>
  );
}

function EmptyState({ handle }: { handle: string }) {
  return (
    <div className="mv-marketing sp sp-panel">
      <div className="sp-empty">
        <h2 className="sp-section-title">No saved routes yet</h2>
        <p className="sp-prose">@{handle} hasn't saved any routes.</p>
      </div>
    </div>
  );
}

function SoftWall({ handle }: { handle: string }) {
  return (
    <div className="sp-wall">
      <h2 className="sp-cta-title">Save routes of your own</h2>
      <p className="sp-cta-sub">
        Browse routes in MotoVault, save the ones you want to ride, and follow them on the road.
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
          Get it on Android
        </StoreLink>
      </div>
    </div>
  );
}
