/**
 * The season recap: seven story cards in a row, three free and four Pro, for
 * the season the API shows (last year until the new one has five qualifying
 * rides). A free rider sees each Pro card as its title over a blur, and a tap
 * opens the paywall. The card in view shares as a 1080x1920 story image.
 */
import type { MeasurementSystem } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hashString, SHARE_EXPORT_PX, SHARE_SIZE } from '@/components/share/insights-share';
import { captureShareImage, getExportCardDimensions } from '@/components/share/render-share-card';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { AnalyticsEvent, captureException, trackEvent } from '@/lib/analytics';
import { RIDER_INSIGHTS_PAYWALL_ROW, type RiderInsightsPaywallRow } from '@/lib/paywall-surfaces';
import { presentRiderInsightsPaywall } from '@/lib/subscription';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, layout, space } from '@/theme/spacing';
import { radius, readableWidth, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';
import { StateNotice } from '../details/detail-parts';
import { buildInsightsPaywallCopy, insightsPaywallNumbers } from '../paywall-copy';
import { INSIGHTS_VIEW, type RiderInsightsData, useRiderInsights } from '../use-rider-insights';
import { RECAP_ASPECT, RecapCardView } from './recap-card';
import {
  RECAP_CARD,
  RECAP_STATE,
  RECAP_TIER,
  type RecapCard,
  type RecapCardState,
  recapCards,
  recapSeasonYear,
} from './recap-model';

/** Property on the locked-row events that tells the recap from the list and detail pages. */
const RECAP_SURFACE = 'recap';
const SHARE_SURFACE = 'rider_insights_recap';
/** Recap cards are stories. */
const STORY_PX = SHARE_EXPORT_PX[SHARE_SIZE.STORY];
/** A card takes this share of the screen width, so the next one peeks in. */
const CARD_WIDTH_SHARE = 0.7;
const CARD_MAX_WIDTH = 320;
/** Below this a card's text no longer fits; on a very short screen the page scrolls instead. */
const CARD_MIN_WIDTH = 200;
/** The native header bar under the status bar. */
const HEADER_BAR = 44;
/** Heading, subheading and the card label, at text size 1; they grow with it. */
const TEXT_CHROME = 78;
/** The share button's height. */
const SHARE_BUTTON = space.xxxl + space.sm;

/**
 * A card's width: a share of the screen width, but never so tall that the
 * share button under it falls behind the tab bar.
 */
export function recapCardWidth(input: {
  windowWidth: number;
  windowHeight: number;
  fontScale: number;
  topInset: number;
  bottomClearance: number;
}): number {
  const { windowWidth, windowHeight, fontScale, topInset, bottomClearance } = input;
  const chrome =
    topInset +
    HEADER_BAR +
    space.sm +
    TEXT_CHROME * fontScale +
    2 * layout.sectionGap +
    space.xs +
    SHARE_BUTTON +
    bottomClearance;
  const byHeight = (windowHeight - chrome) / RECAP_ASPECT;
  return Math.max(
    CARD_MIN_WIDTH,
    Math.min(windowWidth * CARD_WIDTH_SHARE, CARD_MAX_WIDTH, byHeight),
  );
}
const DIVIDER_OPACITY = 0.4;
/** Where the capture copy sits: off screen, so the rider never sees it. */
const OFFSCREEN = -100_000;
/**
 * How long the card at export size may take to load its map and ride shape. A
 * ride fetch paused offline never settles; the share gives up instead of spinning.
 */
export const EXPORT_READY_TIMEOUT_MS = 8_000;

/** The paywall row each locked card opens and reports. */
const PAYWALL_ROW: Partial<Record<RecapCard, RiderInsightsPaywallRow>> = {
  [RECAP_CARD.RHYTHM]: RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM,
  [RECAP_CARD.NEW_ROADS]: RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY,
  [RECAP_CARD.TWISTIEST]: RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER,
  [RECAP_CARD.COST]: RIDER_INSIGHTS_PAYWALL_ROW.COST,
};

const nativeShare = () =>
  (require('react-native-share') as typeof import('react-native-share')).default;

/** Left edge of each card in the row; a divider sits between the free and the Pro cards. */
function cardOffsets(cards: readonly RecapCardState[], cardWidth: number): number[] {
  let x = 0;
  return cards.map((entry, i) => {
    if (i > 0 && entry.tier !== cards[i - 1].tier) x += space.md;
    const offset = x;
    x += cardWidth + space.sm;
    return offset;
  });
}

export function RecapScreen() {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  const system = useMeasurementSystem();
  const bottom = useTabBarClearance();
  const { insights, view, unlocking, onPurchased, retry } = useRiderInsights();

  return (
    <ScrollView
      testID="rider-insights-recap"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[readableWidth, { paddingTop: space.sm, paddingBottom: bottom }]}
    >
      {view === INSIGHTS_VIEW.LOADING ? (
        <View testID="recap-loading" style={{ paddingVertical: space.xxxl }}>
          <ActivityIndicator color={t.ink3} />
        </View>
      ) : view !== INSIGHTS_VIEW.READY || !insights ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <StateNotice
            testID={`recap-${view}`}
            title={
              view === INSIGHTS_VIEW.OFFLINE
                ? i18n('riderInsights.offline.title')
                : i18n('riderInsights.error.title')
            }
            body={
              view === INSIGHTS_VIEW.OFFLINE
                ? i18n('riderInsights.offline.body')
                : i18n('riderInsights.error.body')
            }
            action={
              view === INSIGHTS_VIEW.OFFLINE
                ? i18n('riderInsights.offline.retry')
                : i18n('riderInsights.error.retry')
            }
            onAction={() => void retry()}
          />
        </View>
      ) : (
        <RecapBody
          insights={insights}
          system={system}
          unlocking={unlocking}
          onPurchased={() => void onPurchased()}
        />
      )}
    </ScrollView>
  );
}

interface RecapBodyProps {
  insights: RiderInsightsData;
  system: MeasurementSystem;
  unlocking: boolean;
  onPurchased: () => void;
}

function RecapBody({ insights, system, unlocking, onPurchased }: RecapBodyProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomClearance = useTabBarClearance();
  const language = instance.language;
  const cards = useMemo(() => recapCards(insights), [insights]);
  const year = recapSeasonYear(insights);
  const cardWidth = recapCardWidth({
    windowWidth,
    windowHeight,
    fontScale,
    topInset: insets.top,
    bottomClearance,
  });
  const offsets = useMemo(() => cardOffsets(cards, cardWidth), [cards, cardWidth]);
  const [index, setIndex] = useState(0);
  const [exporting, setExporting] = useState<RecapCardState | null>(null);
  const [busy, setBusy] = useState(false);
  const exportRef = useRef<View>(null);
  const exportReady = useRef<((complete: boolean) => void) | null>(null);
  const shownRows = useRef(new Set<RiderInsightsPaywallRow>());
  const current = cards[index] ?? cards[0];

  // Each locked card is a locked row the rider can see: report it once per visit.
  useEffect(() => {
    for (const entry of cards) {
      const row = PAYWALL_ROW[entry.card];
      if (entry.state !== RECAP_STATE.LOCKED || !row || shownRows.current.has(row)) continue;
      shownRows.current.add(row);
      trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_SHOWN, { row, surface: RECAP_SURFACE });
    }
  }, [cards]);

  const unlock = useCallback(
    async (card: RecapCard) => {
      const row = PAYWALL_ROW[card];
      if (!row) return;
      trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, { row, surface: RECAP_SURFACE });
      const copy = buildInsightsPaywallCopy(row, insightsPaywallNumbers(insights), {
        t: i18n,
        system,
        language,
      });
      const result = await presentRiderInsightsPaywall(row, copy);
      if (result === 'purchased' || result === 'restored') onPurchased();
    },
    [insights, i18n, system, language, onPurchased],
  );

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    let nearest = 0;
    offsets.forEach((offset, i) => {
      if (Math.abs(offset - x) < Math.abs(offsets[nearest] - x)) nearest = i;
    });
    setIndex(nearest);
  };

  /** Draw the card at export size off screen, wait for its map and shape, capture, share. */
  const share = useCallback(async () => {
    if (busy) return;
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // The card reports whether it drew everything; a timeout counts as not.
      const ready = new Promise<boolean>((resolve) => {
        exportReady.current = resolve;
        timeout = setTimeout(() => resolve(false), EXPORT_READY_TIMEOUT_MS);
      });
      setExporting(current);
      // Never captured (and cached) without its map or ride shape.
      if (!(await ready)) throw new Error('Recap card did not load for export');
      const key = `recap-${insights.season.from}-${current.card}-${system}-${language}-${hashString(JSON.stringify(insights))}`;
      const uri = await captureShareImage(exportRef, key, STORY_PX);
      const result = await nativeShare().open({
        url: uri,
        type: 'image/png',
        message: i18n('riderInsights.recap.shareMessage', { year }),
        failOnCancel: false,
      });
      if (result.success) {
        trackEvent(AnalyticsEvent.SHARE_COMPLETED, {
          surface: SHARE_SURFACE,
          variant: current.card,
          size: SHARE_SIZE.STORY,
          destination: 'share',
        });
      }
    } catch (error) {
      captureException(error, { source: 'rider-insights.recap-share', card: current.card });
      Alert.alert(i18n('common.error'), i18n('common.genericError'));
    } finally {
      clearTimeout(timeout);
      exportReady.current = null;
      setExporting(null);
      setBusy(false);
    }
  }, [busy, current, insights, system, language, i18n, year]);

  const exportWidth = getExportCardDimensions(STORY_PX).width;

  return (
    <View style={{ gap: layout.sectionGap }}>
      <View style={{ paddingHorizontal: GUTTER, gap: layout.titleGap }}>
        <Text accessibilityRole="header" style={[type.sectionTitle, { color: t.ink }]}>
          {i18n('riderInsights.recap.heading', { year })}
        </Text>
        <Text style={[type.subhead, { color: t.ink3 }]}>
          {i18n('riderInsights.recap.subheading')}
        </Text>
      </View>

      <ScrollView
        testID="recap-cards"
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={offsets}
        onMomentumScrollEnd={onScrollEnd}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space.sm }}
      >
        {cards.map((entry, i) => (
          <View key={entry.card} style={{ flexDirection: 'row', gap: space.sm }}>
            {i > 0 && entry.tier !== cards[i - 1].tier ? (
              <View
                style={{
                  width: 1,
                  marginTop: space.xl,
                  marginHorizontal: space.xxs,
                  backgroundColor: t.ink3,
                  opacity: DIVIDER_OPACITY,
                }}
              />
            ) : null}
            <View style={{ width: cardWidth, gap: space.xs }}>
              <Text testID={`recap-label-${entry.card}`} style={[type.label, { color: t.ink3 }]}>
                {i18n(
                  entry.tier === RECAP_TIER.FREE
                    ? 'riderInsights.recap.labelFree'
                    : 'riderInsights.recap.labelPro',
                  { index: i + 1, total: cards.length },
                )}
              </Text>
              <RecapCardView
                entry={entry}
                insights={insights}
                width={cardWidth}
                system={system}
                unlocking={unlocking}
                onUnlock={() => void unlock(entry.card)}
              />
            </View>
          </View>
        ))}
      </ScrollView>

      {current.state === RECAP_STATE.READY ? (
        <Pressable
          testID="recap-share"
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={() => void share()}
          style={({ pressed }) => ({
            alignSelf: 'center',
            minHeight: space.xxxl + space.sm,
            paddingHorizontal: space.xl,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: t.warm,
            opacity: busy ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={t.onWarm} />
          ) : (
            <Text style={[type.bodyStrong, SYSTEM_WEIGHT.semibold, { color: t.onWarm }]}>
              {i18n('riderInsights.recap.share')}
            </Text>
          )}
        </Pressable>
      ) : null}

      {/* The copy that is captured: the card at export size, off screen. */}
      {exporting ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: OFFSCREEN, top: 0 }}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View ref={exportRef} collapsable={false}>
            <RecapCardView
              entry={exporting}
              insights={insights}
              width={exportWidth}
              system={system}
              rounded={false}
              testID={`recap-export-${exporting.card}`}
              onReady={(complete) => exportReady.current?.(complete)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
