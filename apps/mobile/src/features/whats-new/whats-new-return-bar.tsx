/**
 * The way back from a feature screen a What's New page opened: "‹ Back to
 * What's New" reopens that page, "Next feature ›" the one after it. Each is one
 * `router.push` of the What's New modal, without the boot.
 *
 * Drawn only while the visit is open (closing What's New ends it) and only on a
 * screen that says it was opened from What's New, so a stale route param on a
 * tab screen shows nothing. The destination screen places the bar above its
 * tab bar clearance.
 */

import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { whatsNewReturnHref } from '@/config/routes';
import type { WhatsNewFeature } from '@/data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { installedRelease, NOTHING_SEEN, selectPages } from '@/lib/whats-new';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';
import { MIN_TARGET } from './whats-new-page';

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
}

export function WhatsNewReturnBar({ feature, fromWhatsNew, page }: WhatsNewReturnBarProps) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const router = useRouter();
  const visible = useWhatsNewReturnVisible(fromWhatsNew);
  const pages = useMemo(returnPages, []);

  if (!visible) return null;

  // The reopened screen shows the full set, which can order pages differently
  // from the visit that opened this screen: find the feature's own page there.
  const found = pages.indexOf(feature);
  const current = found >= 0 ? found : Math.min(page ?? 0, pages.length - 1);
  const hasNext = current + 1 < pages.length;

  const go = (action: ReturnAction, target: number) => {
    triggerImpact();
    trackEvent(AnalyticsEvent.WHATS_NEW_RETURNED, { feature, action });
    router.push(whatsNewReturnHref(target));
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        padding: space.xxs,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: t.surface,
      }}
    >
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
            paddingHorizontal: space.sm,
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
