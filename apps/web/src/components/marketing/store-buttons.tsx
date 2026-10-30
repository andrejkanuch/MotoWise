'use client';

import { trackStoreCtaClick } from '@/lib/analytics';
import { buildPlayReferrer, getCampaignParams } from '@/lib/campaign';
import { CtaPlacement, type StoreCtaContext, StorePlatform } from '@/lib/cta-taxonomy';
import { detectPlatform, STORE_LINKS } from '@/lib/store-links';

export { STORE_LINKS };

/**
 * Anchor props for a "download the app" CTA — the single wiring every store CTA
 * on the site delegates to (hero, footer, blog, guide, route, sticky bar…).
 *
 * Session replays showed users double-clicking the App Store link (no feedback
 * that the click worked) and abandoning after the tab navigated away from the
 * landing page. Opening the store in a NEW tab fixes both: the landing page
 * stays put, and the new tab appearing IS the feedback that the click landed —
 * no lingering spinner needed (a spinner still showing after the store opened
 * reads as "stuck" and re-invites the double-click). Tactile press feedback is
 * handled with a CSS `:active` transform on the button. `ctx.sameTab` opts a
 * rare same-tab CTA out of the new tab (event still survives via send_instantly).
 *
 * Spread onto an `<a>`: `<a {...storeAnchorProps('ios', ctx)} className="…">`.
 */
export function storeAnchorProps(platform: StorePlatform, ctx: StoreCtaContext) {
  return {
    href: platform === StorePlatform.Android ? STORE_LINKS.googlePlay : STORE_LINKS.appStore,
    ...(ctx.sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' }),
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      const campaign = getCampaignParams();
      // Resolve the platform at click time when it wasn't known at render — the
      // SSR/pre-detection default is 'unknown' (→ App Store href), so without
      // this an Android tap before the caller's useEffect settled would open the
      // App Store. The click handler always runs post-hydration, so detection is
      // reliable here.
      const resolved = platform === StorePlatform.Unknown ? detectPlatform() : platform;
      // Android install-referrer carries the channel + intent deterministically
      // into the Play install. Set the href at click time (params are client-only,
      // so the SSR href stays clean and hydration-stable). First-touch campaign
      // UTMs win over the CTA's default referrerParams on conflict. Always correct
      // the href to Play for Android — even with no referrer params — so an
      // SSR-defaulted App Store href never sends an Android user to the wrong store.
      // iOS/desktop keep the App Store href (the App Store strips referrers; the
      // clipboard-token path was dropped because it prompted a paste at onboarding).
      if (resolved === StorePlatform.Android) {
        const referrer = { ...ctx.referrerParams, ...campaign };
        e.currentTarget.href = Object.keys(referrer).length
          ? buildPlayReferrer(STORE_LINKS.googlePlay, referrer)
          : STORE_LINKS.googlePlay;
      }
      trackStoreCtaClick(resolved, ctx, campaign ?? undefined);
    },
  } as const;
}

/**
 * A single store-link anchor with click tracking + Google Play referrer wired
 * in. Use from Server Components (footer, cta-section) that can't attach the
 * `onClick` from {@link storeAnchorProps} — this client component owns the
 * handler while accepting the caller's `className`/`style`/`children`.
 */
export function StoreLink({
  platform,
  pageType,
  placement,
  slug,
  sameTab,
  referrerParams,
  className,
  style,
  children,
}: StoreCtaContext & {
  platform: StorePlatform;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      {...storeAnchorProps(platform, { pageType, placement, slug, sameTab, referrerParams })}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

/* The pair uses the kit: copper primary (the verb) and a ghost one step up
   the ramp; focus comes from the root grammar. */
const STORE_BUTTONS_CSS = `
.mv-store {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
`;

export function StoreButtons({
  pageType,
  placement = CtaPlacement.Inline,
  slug,
  referrerParams,
}: Omit<StoreCtaContext, 'placement' | 'sameTab'> & {
  placement?: CtaPlacement;
}) {
  const ctx: StoreCtaContext = { pageType, placement, slug, referrerParams };

  return (
    <div className="mv-store">
      <style>{STORE_BUTTONS_CSS}</style>
      <a {...storeAnchorProps(StorePlatform.Ios, ctx)} className="mv-btn mv-btn-primary">
        <AppleIcon />
        Download for iOS
      </a>
      <a {...storeAnchorProps(StorePlatform.Android, ctx)} className="mv-btn mv-btn-ghost">
        <PlayIcon />
        Download for Android
      </a>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
    </svg>
  );
}
