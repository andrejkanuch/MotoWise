/**
 * The bike plate — the Race Plate world's signature move (DESIGN.md).
 *
 * A rounded number-plate panel whose colour IS the bike's readiness:
 * bone = ready, signal yellow = due soon, red = overdue. The big condensed
 * figure is the distance (or time) to the next thing; the caption says what
 * that thing is; the plate's edge carries the bike's identity. One diagonal
 * livery stripe cuts the top-right corner — the only diagonal in the app.
 *
 * Reused wherever a bike appears (home hero, garage list, sheets) so a rider
 * learns one object. Ink on every plate state is `onPlate`.
 */

import { useEffect } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';

export const PLATE_STATE = {
  READY: 'ready',
  DUE: 'due',
  OVERDUE: 'overdue',
} as const;
export type PlateState = (typeof PLATE_STATE)[keyof typeof PLATE_STATE];

export const PLATE_SIZE = {
  HERO: 'hero',
  COMPACT: 'compact',
} as const;
export type PlateSize = (typeof PLATE_SIZE)[keyof typeof PLATE_SIZE];

const STATE_INDEX: Record<PlateState, number> = {
  [PLATE_STATE.READY]: 0,
  [PLATE_STATE.DUE]: 1,
  [PLATE_STATE.OVERDUE]: 2,
};

const SETTLE_MS = 240;
const STATE_FADE_MS = 200;
const EASE_OUT = Easing.out(Easing.exp);

export interface BikePlateProps {
  state: PlateState;
  /** The big figure, already formatted (e.g. "1,240"). */
  figure: string;
  /** Unit beside the figure (e.g. "km", "days"). */
  unit?: string;
  /** One line saying what the figure counts down to (e.g. "to Oil change"). */
  caption: string;
  /** Short state word printed on the plate edge (e.g. "Ready", "Due soon"). */
  stateLabel: string;
  /** Bike identity on the plate edge (e.g. "Honda Africa Twin · 2022"). */
  identity?: string;
  /** Optional racing-number style index (e.g. "07"). */
  plateNumber?: string;
  size?: PlateSize;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
}

export function BikePlate({
  state,
  figure,
  unit,
  caption,
  stateLabel,
  identity,
  plateNumber,
  size = PLATE_SIZE.HERO,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: BikePlateProps) {
  const { t } = useEditorialTheme();
  const reduceMotion = useReducedMotion();
  const hero = size === PLATE_SIZE.HERO;

  const settle = useSharedValue(reduceMotion ? 1 : 0);
  const stateValue = useSharedValue(STATE_INDEX[state]);

  useEffect(() => {
    settle.value = withTiming(1, { duration: reduceMotion ? 0 : SETTLE_MS, easing: EASE_OUT });
  }, [settle, reduceMotion]);

  useEffect(() => {
    stateValue.value = withTiming(STATE_INDEX[state], {
      duration: reduceMotion ? 0 : STATE_FADE_MS,
      easing: EASE_OUT,
    });
  }, [state, stateValue, reduceMotion]);

  const plateColors = [t.plateReady, t.plateDue, t.plateOverdue];
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ scale: 0.98 + settle.value * 0.02 }],
    backgroundColor: interpolateColor(stateValue.value, [0, 1, 2], plateColors),
  }));

  const ink = t.onPlate;
  const inkSoft = tint(ink, 0.68);
  const figureStyle = hero ? type.plate : type.plateCompact;
  const pad = hero ? space.lg : space.md;

  const body = (
    <Animated.View
      style={[
        {
          borderRadius: radius.plate,
          borderCurve: 'continuous',
          overflow: 'hidden',
          paddingHorizontal: pad,
          paddingTop: pad,
          paddingBottom: hero ? space.lg : space.md,
          gap: hero ? space.xs : space.xxs,
        },
        animatedStyle,
        style,
      ]}
    >
      <LiveryStripe hero={hero} copper={t.warm} ground={t.bg} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {plateNumber ? (
          <Text
            style={[type.label, { color: ink, fontVariant: ['tabular-nums'] }]}
            maxFontSizeMultiplier={1.4}
          >
            {plateNumber}
          </Text>
        ) : null}
        <Text
          style={[type.label, { color: ink, flexShrink: 1 }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
        >
          {stateLabel}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
        <Text
          style={[figureStyle, { color: ink }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={1.2}
        >
          {figure}
        </Text>
        {unit ? (
          <Text
            style={[hero ? type.figure : type.figureSmall, { color: ink }]}
            maxFontSizeMultiplier={1.2}
          >
            {unit}
          </Text>
        ) : null}
      </View>

      <Text style={[hero ? type.bodyStrong : type.subhead, { color: ink }]} numberOfLines={2}>
        {caption}
      </Text>

      {identity ? (
        <View
          style={{
            marginTop: hero ? space.sm : space.xs,
            paddingTop: hero ? space.sm : space.xs,
            borderTopWidth: 1,
            borderTopColor: tint(ink, 0.16),
          }}
        >
          <Text style={[type.label, { color: inkSoft }]} numberOfLines={1}>
            {identity}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${stateLabel}. ${figure} ${unit ?? ''} ${caption}`}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      {body}
    </Pressable>
  );
}

/** Two parallel bands cut diagonally through the plate's top-right corner. */
function LiveryStripe({ hero, copper, ground }: { hero: boolean; copper: string; ground: string }) {
  const length = hero ? 220 : 140;
  const band = hero ? 14 : 9;
  const offset = hero ? 34 : 22;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -length / 2 + offset,
        right: -length / 2 + offset,
        width: length,
        height: length,
        transform: [{ rotate: '45deg' }],
        justifyContent: 'center',
        gap: band / 2,
      }}
    >
      <View style={{ height: band, backgroundColor: copper }} />
      <View style={{ height: band / 2, backgroundColor: ground }} />
    </View>
  );
}
