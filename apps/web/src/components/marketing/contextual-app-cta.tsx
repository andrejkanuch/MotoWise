'use client';

import { palette } from '@motovault/design-system';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { CTA_SCREENSHOT, type CtaAngle } from '@/lib/blog-cta';
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
 * Delegates to the shared store anchor {@link storeAnchorProps}: new tab, UTM +
 * Play referrer, single `store_cta_click` tagged with page_type/placement/slug.
 */
export function ContextualAppCta({
  angle,
  model,
  slug,
  placement = CtaPlacement.MidArticle,
}: {
  angle: CtaAngle;
  /** Resolved bike model, or null → localized "your motorcycle" fallback. */
  model: string | null;
  slug: string;
  placement?: CtaPlacement;
}) {
  const t = useTranslations('Blog');
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const bike = model ?? t('ctaModelFallback');

  return (
    <aside
      className="my-10 flex flex-col gap-5 overflow-hidden rounded-2xl border p-6 sm:flex-row sm:items-center"
      style={{
        borderColor: palette.neutral800,
        backgroundColor: palette.neutral900,
      }}
    >
      <div className="relative hidden h-28 w-28 shrink-0 overflow-hidden rounded-xl sm:block">
        <Image
          src={CTA_SCREENSHOT[angle]}
          alt=""
          fill
          className="object-cover object-top"
          sizes="112px"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="mb-4 text-base font-semibold leading-snug"
          style={{ color: palette.neutral50 }}
        >
          {t(ANGLE_HEADLINE_KEY[angle], { model: bike })}
        </p>
        <a
          {...storeAnchorProps(platform, { pageType: CtaPageType.Blog, placement, slug })}
          className="inline-block rounded-full px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: palette.signature500, color: palette.white }}
        >
          {t('ctaDownloadFree')}
        </a>
      </div>
    </aside>
  );
}
