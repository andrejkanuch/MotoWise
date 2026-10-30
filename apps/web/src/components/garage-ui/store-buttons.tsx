'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { storeAnchorProps } from '@/components/marketing/store-buttons';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';
import { AppleMark, GooglePlayMark } from './brand-icons';
import './garage-ui.css';

/** Store-button marks: one size for both (the kit's inline glyph step). */
const STORE_MARK_SIZE = 16;

type StoreEntry = {
  platform: typeof StorePlatform.Ios | typeof StorePlatform.Android;
  labelKey: 'appStore' | 'googlePlay';
  Mark: typeof AppleMark;
};

const STORES: Record<'ios' | 'android', StoreEntry> = {
  ios: { platform: StorePlatform.Ios, labelKey: 'appStore', Mark: AppleMark },
  android: { platform: StorePlatform.Android, labelKey: 'googlePlay', Mark: GooglePlayMark },
};

/** The detected store first (copper), the other after it (ghost); iOS first until detected. */
const STORE_ORDER: Record<Platform, readonly StoreEntry[]> = {
  ios: [STORES.ios, STORES.android],
  android: [STORES.android, STORES.ios],
  unknown: [STORES.ios, STORES.android],
};

/**
 * Detect the phone after mount (the `contextual-app-cta.tsx` pattern): the
 * server renders the iOS-first pair, the browser then makes the device's own
 * store the copper button. `storeAnchorProps` still resolves the platform at
 * click time, so a tap before the effect settles opens the right store too.
 */
function useStoreOrder(): readonly StoreEntry[] {
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);
  return STORE_ORDER[platform];
}

/**
 * App Store + Google Play links for the garage handoff, on the official store
 * URLs (STORE_LINKS: id6760291360, com.motovault.app). Clicks go through the
 * shared `storeAnchorProps`: new tab, Play install referrer, one
 * `store_cta_click` tagged `page_type: garage`.
 *
 * The official badge artwork is not in the repo, so these are .mv-btn-block
 * buttons with the platform marks, both labelled "Download for iOS/Android":
 * the detected store is the copper action, the other one step up the ramp.
 * Swap in the official badges here, in one place, if they are ever added.
 */
export function StoreButtons({ placement = CtaPlacement.Inline }: { placement?: CtaPlacement }) {
  const t = useTranslations('AppHandoff');
  const ctx = { pageType: CtaPageType.Garage, placement };
  const [primary, secondary] = useStoreOrder();
  return (
    <div className="mvg-store">
      <a
        {...storeAnchorProps(primary.platform, ctx)}
        className="mv-btn mv-btn-primary mv-btn-block"
      >
        <primary.Mark size={STORE_MARK_SIZE} />
        {t(primary.labelKey)}
      </a>
      <a
        {...storeAnchorProps(secondary.platform, ctx)}
        className="mv-btn mv-btn-ghost mv-btn-block"
      >
        <secondary.Mark size={STORE_MARK_SIZE} />
        {t(secondary.labelKey)}
      </a>
    </div>
  );
}

/** "On this tablet? Download for iOS · Download for Android" as inline text links (tablet band). */
export function StoreTextLinks({ placement = CtaPlacement.Inline }: { placement?: CtaPlacement }) {
  const t = useTranslations('AppHandoff');
  const ctx = { pageType: CtaPageType.Garage, placement };
  return (
    <p className="mvg-store-inline" style={{ margin: 0 }}>
      {t('onThisTablet')}
      <a {...storeAnchorProps(StorePlatform.Ios, ctx)} className="mv-link is-quiet is-tall">
        {t('appStore')}
      </a>
      <a {...storeAnchorProps(StorePlatform.Android, ctx)} className="mv-link is-quiet is-tall">
        {t('googlePlay')}
      </a>
    </p>
  );
}
