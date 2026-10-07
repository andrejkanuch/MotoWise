import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { ChevronLeft, Gauge } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BIKE_ORIGIN, type BikeOrigin, type HubUnit } from '../../../lib/bike-hub/constants';
import { formatOdometer, hasOdometer } from '../../../lib/bike-hub/format';
import { triggerImpact } from '../../../utils/haptics';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FONT,
  HUB_HEIGHT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  hub,
} from './tokens';

type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

export type BikeHeaderBike = Pick<Motorcycle, 'make' | 'model' | 'year' | 'currentMileage'>;

const ROW_HEIGHT = 48;
const ROW_HEIGHT_COLLAPSED = 44;
const NAME_SIZE = 22;
const NAME_SIZE_COLLAPSED = 17;
const EYEBROW_SIZE = 10;
const EYEBROW_LINE_HEIGHT = 13;
const BACK_SIZE = 44;
const CHIP_SLOP = Math.ceil((HUB_TOUCH_TARGET - HUB_HEIGHT.small) / 2);

/** Origin → the tab name read out in "Back to …". Existing tab-title keys. */
export const ORIGIN_LABEL_KEY: Record<BikeOrigin, HubCopyKey> = {
  [BIKE_ORIGIN.GARAGE]: 'tabs.garage',
  [BIKE_ORIGIN.HOME]: 'tabs.home',
  [BIKE_ORIGIN.PROFILE]: 'tabs.profile',
};

interface BikeHeaderProps {
  /** `null` while the bike is loading or was not found — the back button still works. */
  bike: BikeHeaderBike | null;
  origin: BikeOrigin;
  /** The bike's own unit (`distanceUnit`) — not the profile unit. */
  unit: HubUnit;
  /** 0 = two-line header, 1 = collapsed into one 44 px row. Driven by the active segment's scroll. */
  collapse: SharedValue<number>;
  onBack: () => void;
  onOdometerPress: () => void;
}

/**
 * Persistent top row of the bike hub: origin-aware back, the bike name in
 * Instrument Serif over a mono eyebrow, and the odometer chip — the only
 * odometer on the page. It never scrolls away; on scroll the name shrinks and
 * the eyebrow fades so the row becomes 44 px. Transforms and opacity only, no
 * layout animation beyond the 4 px row height.
 */
export function BikeHeader({
  bike,
  origin,
  unit,
  collapse,
  onBack,
  onOdometerPress,
}: BikeHeaderProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const rowStyle = useAnimatedStyle(() => ({
    height: interpolate(collapse.value, [0, 1], [ROW_HEIGHT, ROW_HEIGHT_COLLAPSED]),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    transform: [
      // The eyebrow fades out below the name; shift the block down by half its
      // height so the shrunken name stays vertically centred.
      { translateY: interpolate(collapse.value, [0, 1], [0, EYEBROW_LINE_HEIGHT / 2]) },
      { scale: interpolate(collapse.value, [0, 1], [1, NAME_SIZE_COLLAPSED / NAME_SIZE]) },
    ],
  }));
  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.value, [0, 0.6], [1, 0], 'clamp'),
  }));

  // null and 0 both mean "never set": the chip invites setting it instead of showing "0 km".
  const odometerSet = hasOdometer(bike?.currentMileage);
  const odometer = odometerSet ? formatOdometer(bike?.currentMileage ?? 0, i18n.language) : '';
  const chipLabel = odometerSet ? `${odometer} ${unit}` : t('bikeHub.header.setOdometer');
  const chipA11y = odometerSet
    ? t('bikeHub.header.odometerA11y', { value: odometer, unit })
    : t('bikeHub.header.setOdometerA11y');

  return (
    <View style={{ paddingTop: insets.top, paddingHorizontal: 12, backgroundColor: hub.ground }}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, rowStyle]}>
        <Pressable
          testID="bike-header-back"
          onPress={() => {
            triggerImpact();
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('bikeHub.header.backTo', { origin: t(ORIGIN_LABEL_KEY[origin]) })}
          style={({ pressed }) => ({
            width: BACK_SIZE,
            height: BACK_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderCurve: 'continuous',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ChevronLeft size={22} color={hub.text} strokeWidth={2.2} />
        </Pressable>

        <Animated.View style={[{ flex: 1, alignItems: 'center' }, titleStyle]}>
          {bike ? (
            <>
              <Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                accessibilityRole="header"
                numberOfLines={1}
                style={{
                  fontFamily: HUB_FONT.serif,
                  fontSize: NAME_SIZE,
                  lineHeight: 24,
                  color: hub.text,
                }}
              >
                {bike.model}
              </Text>
              <Animated.Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                numberOfLines={1}
                style={[
                  {
                    fontFamily: HUB_FONT.mono,
                    fontSize: EYEBROW_SIZE,
                    lineHeight: EYEBROW_LINE_HEIGHT,
                    letterSpacing: EYEBROW_SIZE * 0.08,
                    textTransform: 'uppercase',
                    color: hub.muted,
                  },
                  eyebrowStyle,
                ]}
              >
                {`${bike.year} · ${bike.make}`}
              </Animated.Text>
            </>
          ) : null}
        </Animated.View>

        {bike ? (
          <Pressable
            testID="bike-header-odometer"
            onPress={() => {
              triggerImpact();
              onOdometerPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={chipA11y}
            hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
            style={({ pressed }) => ({
              height: HUB_HEIGHT.small,
              paddingHorizontal: 12,
              borderRadius: HUB_RADIUS.chip,
              borderCurve: 'continuous',
              backgroundColor: hub.card,
              borderWidth: 1,
              borderColor: hub.hairlineStrong,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Gauge size={14} color={hub.muted} strokeWidth={2} />
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              style={{ fontFamily: HUB_FONT.monoMedium, fontSize: 13, color: hub.text }}
            >
              {chipLabel}
            </Text>
          </Pressable>
        ) : (
          // Keeps the back button's position stable while there is no chip.
          <View style={{ width: BACK_SIZE }} />
        )}
      </Animated.View>
    </View>
  );
}
