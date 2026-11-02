'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StoreLink } from '@/components/marketing/store-buttons';
import { trackStoreCtaClick } from '@/lib/analytics';
import type { CtaPageType } from '@/lib/cta-taxonomy';
import { CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { GET_PATH } from '@/lib/get-link';
import { detectPlatform, type Platform } from '@/lib/store-links';

/**
 * The platform after mount. Server and first client render agree on
 * 'unknown', so nothing re-hydrates.
 */
function useDetectedPlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(StorePlatform.Unknown);
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);
  return platform;
}

/**
 * "Get the app" on a shared object. A phone gets its own store (new tab, Play
 * referrer, the usual `store_cta_click`). A desktop visitor cannot install from
 * the App Store web page, so the link goes to `/get` in the same tab: the
 * headline, the store pair and a QR code for the phone. Before detection the
 * href is `/get` too, which redirects a phone to its store, so an early tap
 * still lands right.
 */
export function GetAppLink({
  pageType,
  placement = CtaPlacement.Footer,
  slug,
  className,
  children,
}: {
  pageType: CtaPageType;
  placement?: CtaPlacement;
  slug?: string;
  className?: string;
  children: ReactNode;
}) {
  const platform = useDetectedPlatform();

  if (platform === StorePlatform.Unknown) {
    return (
      <a
        href={GET_PATH}
        className={className}
        onClick={() =>
          trackStoreCtaClick(StorePlatform.Unknown, { pageType, placement, slug, sameTab: true })
        }
      >
        {children}
      </a>
    );
  }

  return (
    <StoreLink
      platform={platform}
      pageType={pageType}
      placement={placement}
      slug={slug}
      className={className}
    >
      {children}
    </StoreLink>
  );
}

/**
 * The closing pair on a shared object: on a phone, the deep link opens the app
 * and a ghost "Get the app" covers the rider without it; on desktop (or before
 * the platform is known) the deep link would do nothing — Safari says "address
 * is invalid" — so "Get the app" stands alone as the one copper action and
 * goes to `/get`.
 */
export function OpenInAppActions({
  deepLink,
  pageType,
  slug,
}: {
  deepLink: string;
  pageType: CtaPageType;
  slug: string;
}) {
  const platform = useDetectedPlatform();
  const onPhone = platform !== StorePlatform.Unknown;

  return (
    <div className="sp-cta-actions">
      {onPhone && (
        <a href={deepLink} className="mv-btn mv-btn-primary">
          Open in the app
        </a>
      )}
      <GetAppLink
        pageType={pageType}
        slug={slug}
        className={onPhone ? 'mv-btn mv-btn-ghost' : 'mv-btn mv-btn-primary'}
      >
        Get the app
      </GetAppLink>
    </div>
  );
}
