/**
 * A What's New page's button: opens the real feature with ONE navigation action.
 *
 * - Road Atlas and Notes: one `router.dismissTo` to the tab route. It pops the
 *   What's New modal back onto the existing tabs and opens the screen inside
 *   them; a `replace` from the modal stack would add a second tabs navigator to
 *   the root stack on every round trip. The screen gets `from` / `entry` and the
 *   page, and offers the way back while the visit stays open.
 * - Scan: the metered scan entry (quota and paywall unchanged). It pushes the
 *   scan modal on top of What's New, so closing the scan lands back on the page.
 * - No bike yet: Notes and Scan open add bike over What's New instead.
 *
 * Never `back()` followed by another action: two modal updates in flight can
 * leave every sheet dead (react-native-screens issue 4446).
 */

import { useQuery } from '@tanstack/react-query';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import {
  FROM_WHATS_NEW,
  GARAGE_ROUTE,
  MODAL_ROUTE,
  RIDER_INSIGHTS_ENTRY,
  riderInsightsHref,
} from '@/config/routes';
import {
  WHATS_NEW_DESTINATION,
  WHATS_NEW_FEATURES,
  type WhatsNewDestination,
} from '@/data/whats-new-releases';
import { useReceiptScanEntry } from '@/features/receipt-scan/receipt-scan-entry';
import { SCAN_ENTRY_SURFACE } from '@/features/receipt-scan/scan-flow-constants';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { motorcyclesOptions } from '@/lib/query-options';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { selectPrimaryBike } from '@/utils/primary-bike';
import type { TryFeature } from './whats-new-screen';

/** What one button press does: the navigation, and what it records first. */
interface CtaAction {
  /** The rider reaches the feature itself (not add bike first): the page counts as tried. */
  tried: boolean;
  /** The feature screen replaces What's New and offers the way back. */
  returnBar: boolean;
  navigate: () => void;
}

export function useWhatsNewCta(): TryFeature {
  const router = useRouter();
  const { data } = useQuery(motorcyclesOptions());
  const bikeId = selectPrimaryBike(data?.myMotorcycles ?? [])?.id ?? null;
  const scan = useReceiptScanEntry({
    motorcycleId: bikeId ?? undefined,
    surface: SCAN_ENTRY_SURFACE.WHATS_NEW,
  });

  // One navigation per press: a double tap must not open the feature twice.
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );

  return (feature, pageIndex, dataKind) => {
    if (leaving.current) return;
    leaving.current = true;
    const page = String(pageIndex);
    const addBike: CtaAction = {
      tried: false,
      returnBar: false,
      navigate: () => router.push(MODAL_ROUTE.ADD_BIKE as Href),
    };
    const leaveTo = (href: Href): CtaAction => ({
      tried: true,
      returnBar: true,
      navigate: () => router.dismissTo(href),
    });

    const actions: Record<WhatsNewDestination, () => CtaAction> = {
      [WHATS_NEW_DESTINATION.RIDER_INSIGHTS]: () => {
        const href = riderInsightsHref(RIDER_INSIGHTS_ENTRY.WHATS_NEW);
        return leaveTo({ ...href, params: { ...href.params, wnPage: page } } as Href);
      },
      [WHATS_NEW_DESTINATION.BIKE_NOTES]: () =>
        bikeId
          ? leaveTo({
              pathname: GARAGE_ROUTE.NOTES,
              params: { motorcycleId: bikeId, from: FROM_WHATS_NEW, wnPage: page },
            } as Href)
          : addBike,
      [WHATS_NEW_DESTINATION.SCAN_RECEIPT]: () =>
        bikeId ? { tried: true, returnBar: false, navigate: scan.open } : addBike,
    };
    const action = actions[WHATS_NEW_FEATURES[feature].destination]();

    const store = useWhatsNewStore.getState();
    if (action.tried) store.markTried(feature);
    if (action.returnBar) store.setReturnSessionOpen(true);
    trackEvent(AnalyticsEvent.WHATS_NEW_CTA_TAPPED, {
      feature,
      data_kind: dataKind,
      page_index: pageIndex,
    });
    action.navigate();
  };
}
