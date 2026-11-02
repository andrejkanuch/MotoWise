'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { CtaAngle } from '@/lib/blog-cta';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';
import { storeAnchorProps } from './store-buttons';

/** Blog `Blog` i18n key holding the headline for each angle (ICU `{model}`). */
const ANGLE_HEADLINE_KEY: Record<CtaAngle, string> = {
  maintenance: 'ctaMaintenanceHeadline',
  cost: 'ctaCostHeadline',
  guide: 'ctaGuideHeadline',
};

/**
 * Intent-matched, in-article "download the app" CTA. Rendered server-side into
 * the middle of a blog post (after the ~2nd H2) and again at the article end,
 * with copy that matches why the reader is on the page:
 *  - maintenance → service-interval reminders
 *  - cost        → the expense tracker (the #1 paid feature)
 *  - guide       → a service/health history (never AI-led)
 *
 * One surface tile (`.mv-read-cta`): the headline in the display face, the
 * copper button as the only verb. No screenshot — the old crops showed the
 * retired blue-card UI, and a Race Plate crop is not in the repo yet.
 *
 * Delegates to the shared store anchor {@link storeAnchorProps}: new tab, UTM +
 * Play referrer, single `store_cta_click` tagged with page_type/placement/slug.
 */
export function ContextualAppCta({
  angle,
  model,
  makeModel,
  slug,
  placement = CtaPlacement.MidArticle,
  pageType = CtaPageType.Blog,
  headline,
}: {
  angle: CtaAngle;
  /** Resolved bike model, or null → localized "your motorcycle" fallback. */
  model: string | null;
  /** Structured make/model tagged into the Android Play referrer (plan P2.1). */
  makeModel?: { make: string; model: string } | null;
  slug: string;
  placement?: CtaPlacement;
  /** Analytics page type — Blog by default, Guide on /guides. */
  pageType?: CtaPageType;
  /** Pre-translated headline that replaces the angle headline (guides). */
  headline?: string;
}) {
  const t = useTranslations('Blog');
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const bike = model ?? t('ctaModelFallback');

  // Carry the article's channel + bike intent into the Android install referrer;
  // first-touch campaign UTMs still win over these defaults (see storeAnchorProps).
  const referrerParams: Record<string, string> = {
    utm_source: pageType === CtaPageType.Guide ? 'guide' : 'blog',
    utm_medium: 'content',
    utm_campaign: `${pageType === CtaPageType.Guide ? 'guide' : 'blog'}_${angle}`,
    ...(makeModel?.make ? { mv_make: makeModel.make } : {}),
    ...(makeModel?.model ? { mv_model: makeModel.model } : {}),
  };

  return (
    <aside className="mv-read-cta">
      <p>{headline ?? t(ANGLE_HEADLINE_KEY[angle], { model: bike })}</p>
      <a
        {...storeAnchorProps(platform, {
          pageType,
          placement,
          slug,
          referrerParams,
        })}
        className="mv-btn mv-btn-primary"
      >
        {t('ctaDownloadFree')}
      </a>
    </aside>
  );
}
