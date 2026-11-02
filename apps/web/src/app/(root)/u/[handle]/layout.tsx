import Image from 'next/image';
import { notFound } from 'next/navigation';
import { StoreLink } from '@/components/marketing/store-buttons';
import { ShareUnavailable } from '@/components/share-unavailable';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { fetchProfile } from '@/lib/fetch-profile';
import { settleUpstream } from '@/lib/upstream-error';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

// Rendered per request, like /t: an API outage shows ShareUnavailable, and that
// page must never be cached over a good copy. The fetch itself is still cached
// in the data cache, so the API sees at most one call per revalidate window.
export const dynamic = 'force-dynamic';

/**
 * The rider's public shell for /u/[handle]/*: brand, the rider header with a
 * hairline nav, the page, and one left-aligned call to action. Root-only
 * route (English), on the share-page shell (.sp) in both schemes. The only
 * page under it today is /saved, so that tab is the current one.
 */
export default async function UserProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // undefined = the API never answered (outage), null = no such rider
  const profile = await settleUpstream(fetchProfile(handle));

  if (profile === undefined) {
    return <ShareUnavailable what="The rider's page" path={`/u/${handle}/saved`} />;
  }
  if (!profile) {
    notFound();
  }

  const displayName = profile.displayName ?? profile.publicUsername;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mv-marketing sp">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2"
        style={{ background: 'var(--mv-copper)', color: 'var(--mv-on-copper)' }}
      >
        Skip to content
      </a>
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      <main id="main-content" className="sp-main sp-main-tall">
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
            <h1 className="mv-section-title sp-title is-operate">{displayName}</h1>
            <p className="sp-sub">@{profile.publicUsername}</p>
          </div>
        </header>

        <nav className="sp-tabs" aria-label="Rider pages">
          <a href={`/u/${profile.publicUsername}/saved`} aria-current="page">
            Saved routes
          </a>
          <a href={`/rider/${profile.publicUsername}`}>Profile</a>
        </nav>

        <div className="sp-section">{children}</div>
      </main>

      <footer className="sp-cta">
        <div className="sp-cta-inner">
          <h2 className="mv-h2">Keep your own logbook</h2>
          <p className="sp-cta-sub">
            Save routes, record rides and keep the bike&apos;s service history.
          </p>
          <div className="sp-cta-actions">
            <StoreLink
              platform={StorePlatform.Ios}
              pageType={CtaPageType.Rider}
              placement={CtaPlacement.Footer}
              slug={handle}
              className="mv-btn mv-btn-primary"
            >
              Download for iOS
            </StoreLink>
            <StoreLink
              platform={StorePlatform.Android}
              pageType={CtaPageType.Rider}
              placement={CtaPlacement.Footer}
              slug={handle}
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
