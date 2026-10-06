'use client';

import { useTranslations } from 'next-intl';
import { storeAnchorProps } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { AppleMark, GooglePlayMark } from './brand-icons';
import './garage-ui.css';

/**
 * App Store + Google Play links for the garage handoff, on the official store
 * URLs (STORE_LINKS: id6760291360, com.motovault.app). Clicks go through the
 * shared `storeAnchorProps`: new tab, Play install referrer, one
 * `store_cta_click` tagged `page_type: garage`.
 *
 * The official badge artwork is not in the repo, so these are clean text
 * buttons with the platform marks (spec: 56px height). Swap in the official
 * badges here, in one place, if they are ever added.
 */
export function StoreButtons({ placement = CtaPlacement.Inline }: { placement?: CtaPlacement }) {
  const t = useTranslations('AppHandoff');
  const ctx = { pageType: CtaPageType.Garage, placement };
  return (
    <div className="mvg-store">
      <a {...storeAnchorProps(StorePlatform.Ios, ctx)} className="mvg-store-btn mvg-focusable">
        <AppleMark size={20} />
        {t('appStore')}
      </a>
      <a {...storeAnchorProps(StorePlatform.Android, ctx)} className="mvg-store-btn mvg-focusable">
        <GooglePlayMark size={18} />
        {t('googlePlay')}
      </a>
    </div>
  );
}

/** "On this tablet? App Store · Google Play" as inline text links (tablet band). */
export function StoreTextLinks({ placement = CtaPlacement.Inline }: { placement?: CtaPlacement }) {
  const t = useTranslations('AppHandoff');
  const ctx = { pageType: CtaPageType.Garage, placement };
  return (
    <p className="mvg-store-inline" style={{ margin: 0 }}>
      {t('onThisTablet')}
      <a {...storeAnchorProps(StorePlatform.Ios, ctx)} className="mvg-link">
        {t('appStore')}
      </a>
      <a {...storeAnchorProps(StorePlatform.Android, ctx)} className="mvg-link">
        {t('googlePlay')}
      </a>
    </p>
  );
}
