'use client';

import { trackStoreCtaClick } from '@/lib/analytics';
import { buildIntentToken, buildPlayReferrer, getCampaignParams } from '@/lib/campaign';
import { CtaPlacement, type StoreCtaContext, StorePlatform } from '@/lib/cta-taxonomy';

const STORE_LINKS = {
  appStore: 'https://apps.apple.com/us/app/motovault/id6760291360',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.motovault.app',
} as const;

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
      // Android install-referrer carries the channel + intent deterministically
      // into the Play install. Set it at click time (params are client-only, so
      // the SSR href stays clean and hydration-stable). First-touch campaign
      // UTMs win over the CTA's default referrerParams on conflict. iOS has no
      // equivalent (App Store strips referrers — see P2.4 clipboard/ASA path).
      if (platform === StorePlatform.Android && (campaign || ctx.referrerParams)) {
        const referrer = { ...ctx.referrerParams, ...campaign };
        e.currentTarget.href = buildPlayReferrer(STORE_LINKS.googlePlay, referrer);
      }
      // iOS: the App Store strips referrers, so carry the same make/model intent
      // via a clipboard token the app reads on first launch (P2.4). Best-effort on
      // the click gesture; only writes when there is a bike intent (mv_make).
      if (platform === StorePlatform.Ios) {
        const token = buildIntentToken({ ...ctx.referrerParams, ...campaign });
        if (token) {
          try {
            void navigator.clipboard?.writeText(token).catch(() => {});
          } catch {
            // clipboard unavailable / denied — attribution is best-effort.
          }
        }
      }
      trackStoreCtaClick(platform, ctx, campaign ?? undefined);
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
      {...storeAnchorProps(platform, { pageType, placement, slug, sameTab })}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

export function StoreButtons({
  size = 'md',
  pageType,
  placement = CtaPlacement.Inline,
  slug,
}: Omit<StoreCtaContext, 'placement' | 'sameTab'> & {
  size?: 'sm' | 'md' | 'lg';
  placement?: CtaPlacement;
}) {
  const ctx: StoreCtaContext = { pageType, placement, slug };
  const styles = {
    sm: 'px-5 py-2.5 text-sm gap-3',
    md: 'px-6 sm:px-8 py-3.5 text-base gap-4',
    lg: 'px-6 sm:px-10 py-4 text-base sm:text-lg gap-4',
  } as const;

  return (
    <div className={`flex flex-wrap items-center ${styles[size]}`}>
      <a
        {...storeAnchorProps(StorePlatform.Ios, ctx)}
        className="cta-primary cta-glow group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-warm-500 px-6 sm:px-10 py-4 text-base sm:text-lg font-semibold text-neutral-950 shadow-lg shadow-warm-500/25 transition hover:bg-warm-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
        <span className="absolute inset-0 -translate-x-full bg-warm-300 transition-transform duration-300 ease-out group-hover:translate-x-0" />
        <span className="relative flex items-center gap-2">
          <AppleIcon />
          App Store
        </span>
      </a>
      <a
        {...storeAnchorProps(StorePlatform.Android, ctx)}
        className="cta-secondary inline-flex items-center justify-center rounded-full border-2 border-neutral-600 px-6 sm:px-8 py-3.5 text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
        <span className="flex items-center gap-2">
          <PlayIcon />
          Google Play
        </span>
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
