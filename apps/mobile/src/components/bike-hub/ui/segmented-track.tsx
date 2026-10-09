import { Pressable, Text, View } from 'react-native';
import { triggerSelection } from '../../../utils/haptics';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FIGURE,
  HUB_FIGURE_STRONG,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  SYSTEM_WEIGHT,
  useHubTheme,
} from './tokens';

const TRACK_PADDING = 2;
const OPTION_HEIGHT = 32;
/** Vertical slop that grows an option to a full touch target. */
const OPTION_SLOP = Math.ceil((HUB_TOUCH_TARGET - OPTION_HEIGHT) / 2);
const COUNT_SEPARATOR = ' · ';

export interface SegmentedTrackOption<K extends string | number> {
  key: K;
  label: string;
  /** Appended as "Label · N" in condensed figures. */
  count?: number;
  /** The label itself is a number (a year): set it in condensed figures. */
  figure?: boolean;
  testID?: string;
}

interface SegmentedTrackProps<K extends string | number> {
  options: readonly SegmentedTrackOption<K>[];
  selected: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}

/**
 * The hub's in-content segmented control: equal-width options on a card-colour
 * track, the selected one raised. Used by Service (Active / History) and Costs
 * (year / all time) so both switches look and behave the same. The bike's own
 * Overview / Service / Costs / Bike switch is `SegmentBar`.
 */
export function SegmentedTrack<K extends string | number>({
  options,
  selected,
  onChange,
  accessibilityLabel,
}: SegmentedTrackProps<K>) {
  const hub = useHubTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: TRACK_PADDING,
        padding: TRACK_PADDING,
        borderRadius: HUB_RADIUS.segment + TRACK_PADDING,
        borderCurve: 'continuous',
        backgroundColor: hub.card,
        borderWidth: 1,
        borderColor: hub.hairline,
      }}
    >
      {options.map((option) => {
        const isSelected = option.key === selected;
        const labelFont = option.figure
          ? { ...(isSelected ? HUB_FIGURE_STRONG : HUB_FIGURE), fontSize: 15 }
          : { ...SYSTEM_WEIGHT.semibold, fontSize: 13 };
        return (
          <Pressable
            key={option.key}
            testID={option.testID}
            onPress={() => {
              if (isSelected) return;
              triggerSelection();
              onChange(option.key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={
              option.count === undefined ? option.label : `${option.label}, ${option.count}`
            }
            accessibilityState={{ selected: isSelected }}
            hitSlop={{ top: OPTION_SLOP, bottom: OPTION_SLOP }}
            android_ripple={{ color: hub.ripple }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: OPTION_HEIGHT,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: HUB_RADIUS.segment - 1,
              borderCurve: 'continuous',
              backgroundColor: isSelected ? hub.raised : undefined,
              opacity: pressed && !isSelected && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
            })}
          >
            {/* Control chrome: capped and on one line — "Active · 10" broke in
                two at accessibility sizes. */}
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              style={{
                ...labelFont,
                lineHeight: 18,
                textAlign: 'center',
                color: isSelected ? hub.text : hub.dim,
              }}
            >
              {option.label}
              {option.count === undefined ? null : (
                <Text style={HUB_FIGURE_STRONG}>{`${COUNT_SEPARATOR}${option.count}`}</Text>
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
