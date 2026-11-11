/**
 * The way back from a feature screen a What's New page opened: "‹ Back to
 * What's New" reopens that page, "Next feature ›" the one after it.
 *
 * - A screen that replaced What's New (Rider insights, Notes) pushes the
 *   What's New modal again, without the boot: one `router.push`.
 * - A screen opened on top of What's New (the scan) pops back to it with one
 *   `router.back()`; for "Next feature" it first asks What's New to move on to
 *   the page after this feature.
 *
 * Drawn only while the visit is open (closing What's New ends it) and only on a
 * screen that says it was opened from What's New, so a stale route param on a
 * tab screen shows nothing. The destination screen places the bar above its
 * tab bar clearance.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { FROM_WHATS_NEW, whatsNewReturnHref } from '@/config/routes';
import { WHATS_NEW_MIN_TARGET as MIN_TARGET, WHATS_NEW_TIMING } from '@/config/whats-new';
import type { WhatsNewFeature } from '@/data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { installedRelease, NOTHING_SEEN, selectPages } from '@/lib/whats-new';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';

/** What the rider did on the bar, as sent on the returned event. */
export const WHATS_NEW_RETURN_ACTION = { BACK: 'back', NEXT: 'next' } as const;
type ReturnAction = (typeof WHATS_NEW_RETURN_ACTION)[keyof typeof WHATS_NEW_RETURN_ACTION];

const ICON = 18;
const PRESSED_OPACITY = 0.6;

/** The `wnPage` route param as a page index, or null when missing or junk. */
export function whatsNewPageParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

/**
 * Where a screen was opened from, read from its `from` / `wnPage` params: the
 * What's New page (null when the page is unknown), or undefined when it was not
 * opened from What's New at all.
 */
export function whatsNewOrigin(
  from: string | string[] | undefined,
  wnPage: string | string[] | undefined,
): number | null | undefined {
  const source = Array.isArray(from) ? from[0] : from;
  return source === FROM_WHATS_NEW ? whatsNewPageParam(wnPage) : undefined;
}

/** Whether a screen opened `fromWhatsNew` should show the bar right now. */
export function useWhatsNewReturnVisible(fromWhatsNew: boolean): boolean {
  const open = useWhatsNewStore((s) => s.returnSessionOpen);
  return fromWhatsNew && open;
}

/**
 * The features What's New shows when reopened from a feature: the release's
 * full set, which is what the reopened screen renders.
 */
function returnPages(): WhatsNewFeature[] {
  return selectPages(installedRelease(), NOTHING_SEEN).map((entry) => entry.feature);
}

interface WhatsNewReturnBarProps {
  /** The feature this screen is. */
  feature: WhatsNewFeature;
  /** The screen got the What's New `from` / `entry` param. */
  fromWhatsNew: boolean;
  /** The page it was opened from (`wnPage`), used when the feature has no page on the way back. */
  page: number | null;
  /** This screen sits on top of the open What's New, so the way back is a pop. */
  stacked?: boolean;
}

export function WhatsNewReturnBar({
  feature,
  fromWhatsNew,
  page,
  stacked = false,
}: WhatsNewReturnBarProps) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const router = useRouter();
  const visible = useWhatsNewReturnVisible(fromWhatsNew);
  const fullSet = useMemo(returnPages, []);
  const visitPages = useWhatsNewStore((s) => s.visitPages);
  // Popping back lands on the open visit, whose pages can be fewer than the full set.
  const pages = stacked && visitPages ? visitPages : fullSet;
  // One What's New per press: a double tap must not stack two of them.
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );

  if (!visible) return null;

  // The screen the bar leads to (the reopened full set, or the open visit when
  // stacked) can order pages differently from the visit that opened this
  // screen: find the feature's own page there.
  const found = pages.indexOf(feature);
  const current = found >= 0 ? found : Math.min(page ?? 0, pages.length - 1);
  const hasNext = current + 1 < pages.length;

  const go = (action: ReturnAction, target: number) => {
    if (leaving.current) return;
    leaving.current = true;
    setTimeout(() => {
      leaving.current = false;
    }, WHATS_NEW_TIMING.TAP_LATCH_MS);
    triggerImpact();
    trackEvent(AnalyticsEvent.WHATS_NEW_RETURNED, { feature, action });
    if (!stacked) {
      router.push(whatsNewReturnHref(target));
      return;
    }
    if (action === WHATS_NEW_RETURN_ACTION.NEXT) useWhatsNewStore.getState().setNextAfter(feature);
    router.back();
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => go(WHATS_NEW_RETURN_ACTION.BACK, current)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: MIN_TARGET,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.xxs,
          paddingHorizontal: space.sm,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: t.warm,
          opacity: pressed ? PRESSED_OPACITY : 1,
        })}
      >
        <ChevronLeft size={ICON} color={t.onWarm} />
        <Text numberOfLines={1} style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.onWarm }]}>
          {tr('whatsNew.carousel.returnBar.back')}
        </Text>
      </Pressable>
      {hasNext ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => go(WHATS_NEW_RETURN_ACTION.NEXT, current + 1)}
          style={({ pressed }) => ({
            minHeight: MIN_TARGET,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xxs,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderCurve: 'continuous',
            backgroundColor: t.surface2,
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}
        >
          <Text numberOfLines={1} style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.ink }]}>
            {tr('whatsNew.carousel.returnBar.next')}
          </Text>
          <ChevronRight size={ICON} color={t.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}
