'use client';

import { useEffect, useState } from 'react';
import { StoreLink } from '@/components/marketing/store-buttons';
import type { CtaPageType } from '@/lib/cta-taxonomy';
import { CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';

/**
 * The closing pair on a shared object: on a phone, the deep link opens the app
 * and a ghost "Get the app" covers the rider without it; on desktop (or before
 * the platform is known) the deep link would do nothing — Safari says "address
 * is invalid" — so the store link stands alone as the one copper action.
 * Server and first client render agree on 'unknown', so nothing re-hydrates.
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
  const [platform, setPlatform] = useState<Platform>(StorePlatform.Unknown);
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const onPhone = platform !== StorePlatform.Unknown;

  return (
    <div className="sp-cta-actions">
      {onPhone && (
        <a href={deepLink} className="mv-btn mv-btn-primary">
          Open in the app
        </a>
      )}
      <StoreLink
        platform={platform}
        pageType={pageType}
        placement={CtaPlacement.Footer}
        slug={slug}
        className={onPhone ? 'mv-btn mv-btn-ghost' : 'mv-btn mv-btn-primary'}
      >
        Get the app
      </StoreLink>
    </div>
  );
}
