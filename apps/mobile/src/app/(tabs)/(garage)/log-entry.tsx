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
import { SheetScroll } from '../../../components/bike-hub/sheets/sheet-scroll';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_FONT, hub } from '../../../components/bike-hub/ui/tokens';
import { useCurrency } from '../../../hooks/use-currency';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { bikeDisplayName } from '../../../lib/bike-hub/format';
import { triggerImpact } from '../../../utils/haptics';

/** If the sheet's closing transition never reports, open the form anyway. */
const DISMISS_FALLBACK_MS = 600;
const OPTION_MIN_HEIGHT = 64;

interface StackState {
  index?: number;
  routes: Array<{ key: string; state?: StackState }>;
}

/** A navigator that outlives this sheet (the tabs above the garage stack). */
interface ParentNavigation {
  getState: () => StackState | undefined;
}

/** The slice of the native-stack navigation object this screen uses; `useNavigation` is untyped for it. */
interface SheetNavigation {
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data: { closing: boolean } }) => void,
  ) => () => void;
  getState: () => StackState | undefined;
  getParent: () => ParentNavigation | undefined;
}

function focusedRoute(state: StackState | undefined): StackState['routes'][number] | undefined {
  if (!state) return undefined;
  return state.routes[state.index ?? state.routes.length - 1];
}

/**
 * The screen under this sheet in its stack — where the rider must still be when
 * the fallback timer opens the chosen form. `null` when it cannot be read.
 */
function screenBeneath(navigation: SheetNavigation): string | null {
  try {
    const state = navigation.getState();
    const index = state?.index ?? (state ? state.routes.length - 1 : 0);
    return state?.routes[index - 1]?.key ?? null;
  } catch (_error) {
    return null;
  }
}

function parentOf(navigation: SheetNavigation): ParentNavigation | undefined {
  try {
    return navigation.getParent();
  } catch (_error) {
    return undefined;
  }
}

/**
 * The screen the rider is on right now, read through the PARENT navigator: the
 * sheet's own navigation object is dead once the sheet is dismissed and may
 * still report the stack as it was. The parent's focused route carries the
 * garage stack's live state. `null` when it cannot be read.
 */
function currentScreen(parent: ParentNavigation | undefined): string | null {
  try {
    return focusedRoute(focusedRoute(parent?.getState())?.state)?.key ?? null;
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
  const { currency } = useCurrency();

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
    // Captured while the sheet is alive; both are read again after it is gone.
    const expected = screenBeneath(navigation);
    const parent = parentOf(navigation);
    pendingHref.current = href;
    router.back();
    setTimeout(() => {
      if (pendingHref.current !== href) return;
      pendingHref.current = null;
      // Open the form unless the rider is KNOWN to have moved on (another screen
      // or another tab). When the state cannot be read, open it — a chosen
      // option must never end in nothing.
      const current = currentScreen(parent);
      const movedOn = expected !== null && current !== null && current !== expected;
      if (movedOn) return;
      router.push(href);
    }, DISMISS_FALLBACK_MS);
  };

  // Capped at the hub's 1.3x and scrollable: at the largest text sizes all five
  // options stay reachable and "Maintenance task" never breaks mid-word.
  return (
    <SheetScroll
      testID="log-sheet-scroll"
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
        gap: 10,
      }}
    >
      <SheetGrabber />
      <SheetHeader
        title={t('bikeHub.log.title', { name: bike ? bikeDisplayName(bike) : '' })}
        onCancel={() => router.back()}
      />
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
              <Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 16, color: hub.text }}
              >
                {title}
              </Text>
              <Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 17, color: hub.dim }}
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
