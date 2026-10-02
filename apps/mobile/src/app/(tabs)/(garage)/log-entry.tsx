import { type Href, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LOG_OPTIONS,
  type LogOptionDefinition,
} from '../../../components/bike-hub/sheets/log-options';
import { SheetGrabber, SheetHeader } from '../../../components/bike-hub/sheets/sheet-header';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { HUB_FONT, hub } from '../../../components/bike-hub/ui/tokens';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { bikeDisplayName } from '../../../lib/bike-hub/format';
import { triggerImpact } from '../../../utils/haptics';

/** If the sheet's closing transition never reports, open the form anyway. */
const DISMISS_FALLBACK_MS = 600;
const OPTION_MIN_HEIGHT = 64;

/** The slice of the native-stack navigation object this screen uses; `useNavigation` is untyped for it. */
interface SheetNavigation {
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data: { closing: boolean } }) => void,
  ) => () => void;
  getState: () => { index: number; routes: Array<{ key: string }> } | undefined;
}

/**
 * The screen under this sheet in its stack — where the rider must still be when
 * the fallback timer opens the chosen form. `null` when it cannot be read.
 */
function screenBeneath(navigation: SheetNavigation): string | null {
  try {
    const state = navigation.getState();
    return state?.routes[state.index - 1]?.key ?? null;
  } catch (_error) {
    return null;
  }
}

/** The stack's top screen right now. `null` when it cannot be read. */
function topScreen(navigation: SheetNavigation): string | null {
  try {
    const state = navigation.getState();
    return state?.routes[state.index]?.key ?? null;
  } catch (_error) {
    return null;
  }
}

/**
 * Log sheet: the chooser behind the Overview's "Log" pill. Picking an option
 * dismisses the sheet and opens the form once the dismissal has finished, so
 * two sheets are never stacked. No option is gated.
 */
export default function LogEntrySheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as unknown as SheetNavigation;
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const { bike } = useHubBike(motorcycleId);
  const pendingHref = useRef<Href | null>(null);

  useEffect(() => {
    return navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) return;
      const href = pendingHref.current;
      pendingHref.current = null;
      if (href) router.push(href);
    });
  }, [navigation]);

  const choose = (option: LogOptionDefinition) => {
    // A second tap while the sheet is closing must not pop another screen.
    if (!bike || pendingHref.current) return;
    triggerImpact();
    trackEvent(AnalyticsEvent.BIKE_LOG_OPTION_SELECTED, {
      motorcycle_id: bike.id,
      option: option.id,
    });
    const href = option.href({
      motorcycleId: bike.id,
      bikeName: `${bike.year} ${bike.make} ${bike.model}`,
    });
    const expected = screenBeneath(navigation);
    pendingHref.current = href;
    router.back();
    setTimeout(() => {
      if (pendingHref.current !== href) return;
      pendingHref.current = null;
      // Only if the rider is still where the sheet left them: if they moved on
      // in the meantime, the form must not appear on top of another screen.
      const current = topScreen(navigation);
      if (expected && current && current !== expected) return;
      router.push(href);
    }, DISMISS_FALLBACK_MS);
  };

  return (
    <View
      style={{
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
        gap: 10,
        backgroundColor: hub.card,
      }}
    >
      <SheetGrabber />
      <SheetHeader
        title={t('bikeHub.log.title', { name: bike ? bikeDisplayName(bike) : '' })}
        onCancel={() => router.back()}
      />
      {LOG_OPTIONS.map((option) => {
        const Icon = option.icon;
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
              paddingVertical: 14,
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
                backgroundColor: option.tileBackground,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} color={option.iconColor} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 16, color: hub.text }}>
                {title}
              </Text>
              <Text
                style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 17, color: hub.dim }}
              >
                {sub}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
