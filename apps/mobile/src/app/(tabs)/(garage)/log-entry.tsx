import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LOG_OPTIONS,
  type LogOptionDefinition,
} from '../../../components/bike-hub/sheets/log-options';
import { SheetGrabber, SheetHeader } from '../../../components/bike-hub/sheets/sheet-header';
import { SheetScroll, sheetBottomPadding } from '../../../components/bike-hub/sheets/sheet-scroll';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { HUB_CHROME_MAX_FONT_SCALE, useHubTheme } from '../../../components/bike-hub/ui/tokens';
import { useCurrency } from '../../../hooks/use-currency';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { bikeDisplayName } from '../../../lib/bike-hub/format';
import { SYSTEM_WEIGHT, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';

const OPTION_MIN_HEIGHT = 60;
/** Between options: tight enough that six fit without crowding the sheet. */
const OPTION_GAP = 8;
const TITLE_EXTRA_SPACE = 4;

/**
 * Log sheet: the chooser behind the Overview's "Log" pill. Picking an option
 * REPLACES this sheet with the form, in one navigation action, so two sheets
 * are never stacked. No option is gated.
 *
 * Never `router.back()` here followed by a later `router.push()`. That sends
 * react-native-screens two separate modal updates, and the second one can land
 * while the first dismissal is still finishing. 4.26.2 does not handle that
 * overlap (see software-mansion/react-native-screens issue 4446): the dismissed sheet
 * stays presented natively while JS has dropped it, and `_updatingModals` can
 * stay set for good, so every later sheet open/close is ignored until relaunch.
 * There is also no signal to wait for: this route unmounts as soon as it is
 * popped, so its own 'transitionEnd' never arrives. A replace is a single
 * update that the native stack runs in order: dismiss this sheet, then present
 * the form from the dismissal's completion.
 */
export default function LogEntrySheet() {
  const hub = useHubTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const { bike } = useHubBike(motorcycleId);
  // A second tap before the replace lands must not navigate again.
  const chosen = useRef(false);
  const { currency } = useCurrency();

  const choose = (option: LogOptionDefinition) => {
    if (!bike || chosen.current) return;
    chosen.current = true;
    triggerImpact();
    trackEvent(AnalyticsEvent.BIKE_LOG_OPTION_SELECTED, {
      motorcycle_id: bike.id,
      option: option.id,
    });
    router.replace(
      option.href({
        motorcycleId: bike.id,
        bikeName: `${bike.year} ${bike.make} ${bike.model}`,
      }),
    );
  };

  // Capped at the hub's 1.3x and scrollable: at the largest text sizes all six
  // options stay reachable and no title breaks mid-word.
  return (
    <SheetScroll
      testID="log-sheet-scroll"
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: sheetBottomPadding(insets.bottom),
        gap: OPTION_GAP,
      }}
    >
      <SheetGrabber />
      <SheetHeader
        title={t('bikeHub.log.title', { name: bike ? bikeDisplayName(bike) : '' })}
        onCancel={() => {
          if (chosen.current) return;
          chosen.current = true;
          router.back();
        }}
      />
      {/* The title sits further from the list than the rows sit from each other. */}
      <View style={{ height: TITLE_EXTRA_SPACE }} />
      {LOG_OPTIONS.map((option) => {
        const Icon = option.iconFor?.(currency) ?? option.icon;
        const title = t(option.titleKey);
        const sub = t(option.subKey);
        return (
          <Pressable
            key={option.id}
            testID={`log-option-${option.id}`}
            onPress={() => choose(option)}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${sub}`}
            style={({ pressed }) => ({
              minHeight: OPTION_MIN_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: hub.option,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: hub[option.tileTone],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} color={hub[option.iconTone]} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                style={[type.bodyStrong, { color: hub.text }]}
              >
                {title}
              </Text>
              <Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                style={[type.label, SYSTEM_WEIGHT.regular, { color: hub.dim }]}
              >
                {sub}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </SheetScroll>
  );
}
