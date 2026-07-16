'use client';

import { palette } from '@motovault/design-system';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { storeAnchorProps } from '@/components/marketing/store-buttons';
import { type CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';

/**
 * Platform-aware "Download Free" CTA for article ends (blog + guide).
 *
 * Delegates to the shared store anchor {@link storeAnchorProps}: opens the store
 * in a NEW tab, stamps first-touch UTM + Google Play install referrer, and fires
 * a single `store_cta_click` tagged with page_type/placement/slug. Resolves to
 * the App Store on iOS/desktop and Google Play on Android via client-side UA
 * detection (`Platform` and `StorePlatform` share the same string union, so the
 * detected value is passed straight through).
 */
export function DownloadAppButton({
  pageType,
  slug,
  placement = CtaPlacement.EndArticle,
}: {
  pageType: CtaPageType;
  slug?: string;
  placement?: CtaPlacement;
}) {
  const t = useTranslations('Blog');
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <a
      {...storeAnchorProps(platform, { pageType, placement, slug })}
      className="inline-block rounded-full px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{ backgroundColor: palette.signature500, color: palette.white }}
    >
      {t('ctaDownloadFree')}
    </a>
  );
}
