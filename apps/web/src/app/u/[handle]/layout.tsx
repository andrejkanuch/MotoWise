import Image from 'next/image';
import { notFound } from 'next/navigation';
import { StoreLink } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { fetchProfile } from '../../../lib/fetch-profile';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

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
  const profile = await fetchProfile(handle);

  if (!profile) {
    notFound();
  }

  const displayName = profile.displayName ?? profile.publicUsername;
  const initial = displayName.charAt(0).toUpperCase();

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
