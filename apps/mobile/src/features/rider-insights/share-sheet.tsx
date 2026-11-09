/**
 * "Share your season": the free season-lines image or the Pro Atlas poster,
 * as a 4:5 feed post or a 9:16 story, with the ride ends trimmed off by
 * default. The chosen image is rendered off screen at its export size and
 * captured from there, so the file is sharp at 1080 px wide.
 */
import { palette } from '@motovault/design-system';
import type { MeasurementSystem } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Lock, Share as ShareIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtlasPosterCard, posterBaseUrl } from '@/components/share/cards/atlas-poster-card';
import { SeasonLinesCard } from '@/components/share/cards/season-lines-card';
import {
  buildInsightsSharePayload,
  INSIGHTS_SHARE_IMAGE,
  type InsightsShareImage,
  insightsShareCacheKey,
  SHARE_EXPORT_PX,
  SHARE_SIZE,
  type ShareSize,
} from '@/components/share/insights-share';
import { captureShareImage, getExportCardDimensions } from '@/components/share/render-share-card';
import { ShareToast } from '@/components/share/share-toast';
import { NativeToggle } from '@/components/ui/native-toggle';
import { AnalyticsEvent, captureException, trackEvent } from '@/lib/analytics';
import { RIDER_INSIGHTS_PAYWALL_ROW } from '@/lib/paywall-surfaces';
import { meOptions } from '@/lib/query-options';
import { presentRiderInsightsPaywall } from '@/lib/subscription';
import { EDITORIAL_SCHEME, tint, useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerImpact, triggerSelection } from '@/utils/haptics';
import { buildInsightsPaywallCopy, insightsPaywallNumbers } from './paywall-copy';
import type { RiderInsightsData, RiderInsightsRegion } from './use-rider-insights';

/** Previews share one height; their width follows the chosen size. */
const PREVIEW_HEIGHT = 325;
const SELECTED_RING = 2;
const LOCKED_SCRIM = 0.55;
const SHEET_TOP_GAP = 74;
/** The dimmed screen behind the sheet. */
const SCRIM = { dark: 0.55, light: 0.35 } as const;
const TOUCH_TARGET = 44;
/** Where the capture copy sits: off screen, so the rider never sees it. */
const OFFSCREEN = -100_000;
/** The poster is Pro for its road character, so the paywall opens on that row's copy. */
const POSTER_PAYWALL_ROW = RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER;
const SHARE_SURFACE = 'rider_insights';

/** The native share modules load on first use, off the screen's start-up path. */
const shareDestinations = () =>
  require('@/components/share/share-destinations') as typeof import('@/components/share/share-destinations');
const nativeShare = () =>
  (require('react-native-share') as typeof import('react-native-share')).default;

/** The header's share action on Rider insights. */
export function InsightsShareButton({ onPress }: { onPress: () => void }) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  return (
    <Pressable
      testID="insights-share-button"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={i18n('riderInsights.share.button')}
      hitSlop={space.xs}
      style={{
        minWidth: TOUCH_TARGET,
        minHeight: TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ShareIcon size={22} color={t.ink} strokeWidth={2} />
    </Pressable>
  );
}

interface InsightsShareSheetProps {
  visible: boolean;
  onClose: () => void;
  insights: RiderInsightsData;
  /** Regions in the order the screen shows them; the first is on the main map. */
  regions: readonly RiderInsightsRegion[];
  regionName: (region: RiderInsightsRegion) => string;
  system: MeasurementSystem;
  /** The rider just bought Pro and the server has not caught up: no second paywall. */
  unlocking: boolean;
  onPurchased: () => void;
}

export function InsightsShareSheet({ visible, onClose, ...props }: InsightsShareSheetProps) {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <ShareSheetBody onClose={onClose} {...props} />
    </Modal>
  );
}

type BodyProps = Omit<InsightsShareSheetProps, 'visible'>;

function ShareSheetBody({
  onClose,
  insights,
  regions,
  regionName,
  system,
  unlocking,
  onPurchased,
}: BodyProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const scheme = isDark ? EDITORIAL_SCHEME.DARK : EDITORIAL_SCHEME.LIGHT;
  const { fontScale, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const me = useQuery(meOptions());
  const handle = me.data?.me.publicUsername ?? null;

  const [image, setImage] = useState<InsightsShareImage>(INSIGHTS_SHARE_IMAGE.SEASON_LINES);
  const [size, setSize] = useState<ShareSize>(SHARE_SIZE.FEED);
  const [hideEnds, setHideEnds] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settledBase, setSettledBase] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; message: string | null }>({
    key: 0,
    message: null,
  });
  const captureRef = useRef<View>(null);

  useEffect(() => {
    trackEvent(AnalyticsEvent.SHARE_SHEET_OPENED, { surface: SHARE_SURFACE });
  }, []);

  const posterLocked = !insights.isPro;
  const payload = useMemo(
    () =>
      buildInsightsSharePayload({
        insights,
        regions,
        regionName,
        hideEnds,
        handle,
        measurementSystem: system,
      }),
    [insights, regions, regionName, hideEnds, handle, system],
  );

  const posterBase = posterBaseUrl(payload, size, scheme);
  const ready =
    image === INSIGHTS_SHARE_IMAGE.SEASON_LINES ||
    posterBase === null ||
    settledBase === posterBase;
  const exportWidth = getExportCardDimensions(SHARE_EXPORT_PX[size]).width;
  const previewWidth =
    (PREVIEW_HEIGHT * SHARE_EXPORT_PX[size].width) / SHARE_EXPORT_PX[size].height;

  const selectPoster = useCallback(async () => {
    if (!posterLocked) {
      triggerSelection();
      setImage(INSIGHTS_SHARE_IMAGE.ATLAS_POSTER);
      return;
    }
    if (unlocking) return;
    const copy = buildInsightsPaywallCopy(POSTER_PAYWALL_ROW, insightsPaywallNumbers(insights), {
      t: i18n,
      system,
      language: instance.language,
    });
    const result = await presentRiderInsightsPaywall(POSTER_PAYWALL_ROW, copy);
    if (result === 'purchased' || result === 'restored') onPurchased();
  }, [posterLocked, unlocking, insights, i18n, system, instance.language, onPurchased]);

  /** Capture the chosen image at export size, or reuse the file from an identical capture. */
  const exportImage = useCallback(
    () =>
      captureShareImage(
        captureRef,
        insightsShareCacheKey({ image, size, scheme, fontScale, payload }),
        SHARE_EXPORT_PX[size],
      ),
    [image, size, scheme, fontScale, payload],
  );

  const run = useCallback(
    async (destination: 'save' | 'share') => {
      if (busy || !ready) return;
      triggerImpact(Haptics.ImpactFeedbackStyle.Light);
      setBusy(true);
      try {
        const uri = await exportImage();
        if (destination === 'save') {
          const { executeShareDestination, getToastMessage } = shareDestinations();
          const result = await executeShareDestination('saveImage', uri, payload.cacheId);
          if (result.success) trackShared(image, size, destination);
          setToast((prev) => ({
            key: prev.key + 1,
            message: getToastMessage('saveImage', result),
          }));
        } else {
          const RNShare = nativeShare();
          const result = await RNShare.open({
            url: uri,
            type: 'image/png',
            message: i18n('riderInsights.share.message', { year: payload.seasonYear }),
            failOnCancel: false,
          });
          if (result.success) trackShared(image, size, destination);
        }
      } catch (error) {
        captureException(error, { source: 'rider-insights.share-sheet', destination });
      } finally {
        setBusy(false);
      }
    },
    [busy, ready, exportImage, payload, image, size, i18n],
  );

  const option = (
    id: InsightsShareImage,
    name: string,
    caption: string,
    card: React.ReactNode,
    locked: boolean,
    onPress: () => void,
  ) => {
    const selected = image === id;
    return (
      <Pressable
        key={id}
        testID={`share-option-${id}`}
        accessibilityRole={locked ? 'button' : 'radio'}
        accessibilityState={locked ? undefined : { checked: selected }}
        accessibilityLabel={
          locked
            ? i18n('riderInsights.share.lockedA11y', { name })
            : i18n('riderInsights.share.optionA11y', { name, caption })
        }
        onPress={onPress}
        style={{ width: previewWidth, gap: space.xs }}
      >
        <View
          style={{
            width: previewWidth,
            height: PREVIEW_HEIGHT,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            overflow: 'hidden',
            borderWidth: SELECTED_RING,
            borderColor: selected ? t.warm : 'transparent',
          }}
        >
          {card}
          {locked ? (
            <View
              testID="share-poster-locked"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xs,
                backgroundColor: tint(t.bg, LOCKED_SCRIM),
              }}
            >
              <Lock size={22} color={t.ink} strokeWidth={2} />
              <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>
                {unlocking
                  ? i18n('riderInsights.howYouRide.unlocking')
                  : i18n('riderInsights.howYouRide.unlock')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.ink }]}>{name}</Text>
        <Text style={[type.caption, { color: t.ink3 }]}>{caption}</Text>
      </Pressable>
    );
  };

  const cardWidth = previewWidth - 2 * SELECTED_RING;
  const sizes = [
    { id: SHARE_SIZE.FEED, label: i18n('riderInsights.share.sizeFeed') },
    { id: SHARE_SIZE.STORY, label: i18n('riderInsights.share.sizeStory') },
  ];

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={i18n('riderInsights.share.close')}
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tint(palette.black, isDark ? SCRIM.dark : SCRIM.light),
        }}
      />

      {/* The copy that is captured: the chosen image at its export size, off screen. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: OFFSCREEN, top: 0 }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <View ref={captureRef} collapsable={false}>
          {image === INSIGHTS_SHARE_IMAGE.ATLAS_POSTER ? (
            <AtlasPosterCard
              payload={payload}
              size={size}
              width={exportWidth}
              scheme={scheme}
              onBaseSettled={() => setSettledBase(posterBase)}
            />
          ) : (
            <SeasonLinesCard payload={payload} size={size} width={exportWidth} />
          )}
        </View>
      </View>

      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          maxHeight: windowHeight - insets.top - SHEET_TOP_GAP,
          backgroundColor: t.bg,
          borderTopLeftRadius: radius.plate,
          borderTopRightRadius: radius.plate,
          borderCurve: 'continuous',
        }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: space.md }}>
          <View
            style={{
              width: space.xxxl,
              height: space.xxs,
              borderRadius: radius.pill,
              borderCurve: 'continuous',
              backgroundColor: t.line2,
              alignSelf: 'center',
              marginTop: space.xs,
            }}
          />
          <View
            style={{
              paddingHorizontal: layout.sheetGutter,
              paddingTop: space.sm,
              gap: layout.titleGap,
            }}
          >
            <Text accessibilityRole="header" style={[type.sheetTitle, { color: t.ink }]}>
              {i18n('riderInsights.share.title')}
            </Text>
            <Text style={[type.subhead, { color: t.ink3 }]}>
              {i18n('riderInsights.share.subtitle')}
            </Text>
          </View>

          <ScrollView
            horizontal
            accessibilityRole="radiogroup"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: layout.sheetGutter,
              paddingTop: space.md,
              gap: space.sm,
            }}
          >
            {option(
              INSIGHTS_SHARE_IMAGE.SEASON_LINES,
              i18n('riderInsights.share.seasonLines'),
              i18n('riderInsights.share.seasonLinesCaption'),
              <SeasonLinesCard payload={payload} size={size} width={cardWidth} />,
              false,
              () => {
                triggerSelection();
                setImage(INSIGHTS_SHARE_IMAGE.SEASON_LINES);
              },
            )}
            {option(
              INSIGHTS_SHARE_IMAGE.ATLAS_POSTER,
              i18n('riderInsights.share.atlasPoster'),
              i18n('riderInsights.share.atlasPosterCaption'),
              <AtlasPosterCard payload={payload} size={size} width={cardWidth} scheme={scheme} />,
              posterLocked,
              () => void selectPoster(),
            )}
          </ScrollView>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={i18n('riderInsights.share.sizeA11y')}
            style={{
              flexDirection: 'row',
              marginHorizontal: layout.sheetGutter,
              marginTop: space.lg,
              padding: SELECTED_RING,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              backgroundColor: t.surface2,
            }}
          >
            {sizes.map(({ id, label }) => {
              const selected = size === id;
              return (
                <Pressable
                  key={id}
                  testID={`share-size-${id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    triggerSelection();
                    setSize(id);
                  }}
                  style={{
                    flex: 1,
                    minHeight: space.xxl,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.chip - SELECTED_RING,
                    borderCurve: 'continuous',
                    backgroundColor: selected ? t.surface : 'transparent',
                  }}
                >
                  <Text
                    style={[
                      type.label,
                      selected ? SYSTEM_WEIGHT.semibold : null,
                      { color: selected ? t.ink : t.ink2 },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            testID="share-hide-ends"
            accessibilityRole="switch"
            accessibilityState={{ checked: hideEnds }}
            accessibilityLabel={i18n('riderInsights.share.hideEnds')}
            accessibilityHint={i18n('riderInsights.share.hideEndsCaption')}
            onPress={() => setHideEnds((on) => !on)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              minHeight: space.xxxl + space.sm,
              marginHorizontal: layout.sheetGutter,
              marginTop: space.md,
              paddingHorizontal: space.md,
              paddingVertical: space.xs,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: t.surface,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.ink }]}>
                {i18n('riderInsights.share.hideEnds')}
              </Text>
              <Text style={[type.caption, { color: t.ink3 }]}>
                {i18n('riderInsights.share.hideEndsCaption')}
              </Text>
            </View>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <NativeToggle value={hideEnds} onValueChange={setHideEnds} tint={t.warm} />
            </View>
          </Pressable>
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            gap: space.sm,
            paddingHorizontal: layout.sheetGutter,
            paddingTop: layout.footerTop,
            paddingBottom: insets.bottom + space.sm,
            borderTopWidth: 0.5,
            borderTopColor: t.line,
          }}
        >
          <FooterButton
            testID="share-save"
            label={i18n('riderInsights.share.save')}
            disabled={busy || !ready}
            onPress={() => void run('save')}
            background={t.surface2}
            color={t.ink}
            flex={1}
          />
          <FooterButton
            testID="share-share"
            label={i18n('riderInsights.share.share')}
            disabled={busy || !ready}
            busy={busy}
            onPress={() => void run('share')}
            background={t.warm}
            color={t.onWarm}
            flex={1.4}
          />
        </View>
        <ShareToast key={toast.key} message={toast.message} />
      </Animated.View>
    </View>
  );
}

function trackShared(image: InsightsShareImage, size: ShareSize, destination: string) {
  trackEvent(AnalyticsEvent.SHARE_COMPLETED, {
    surface: SHARE_SURFACE,
    variant: image,
    size,
    destination,
  });
}

interface FooterButtonProps {
  testID: string;
  label: string;
  disabled: boolean;
  busy?: boolean;
  onPress: () => void;
  background: string;
  color: string;
  flex: number;
}

function FooterButton({
  testID,
  label,
  disabled,
  busy,
  onPress,
  background,
  color,
  flex,
}: FooterButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex,
        minHeight: space.xxxl + space.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.control,
        borderCurve: 'continuous',
        backgroundColor: background,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[type.bodyStrong, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}
