import { Delete } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import {
  ODOMETER_KEY,
  type OdometerDigit,
  type OdometerKey,
} from '../../../lib/bike-hub/constants';
import { triggerSelection } from '../../../utils/haptics';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_FONT, HUB_RADIUS, hub } from '../ui/tokens';

const KEY_HEIGHT = 56;
const GAP = 8;
const DIGIT_ROWS: readonly (readonly OdometerDigit[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

interface KeyProps {
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  filled?: boolean;
  testID: string;
  children: React.ReactNode;
}

function Key({
  onPress,
  onLongPress,
  accessibilityLabel,
  filled = true,
  testID,
  children,
}: KeyProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerSelection();
        onPress();
      }}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flex: 1,
        height: KEY_HEIGHT,
        borderRadius: HUB_RADIUS.button,
        borderCurve: 'continuous',
        backgroundColor: filled ? hub.raised : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

interface OdometerKeypadProps {
  onKey: (key: OdometerKey) => void;
  /** "Date · today" / "Date · Sep 28". */
  dateLabel: string;
  onDatePress: () => void;
}

/**
 * The app's own numeric pad — identical on both platforms, no system keyboard.
 * Bottom row: date · 0 · delete (long-press clears).
 */
export function OdometerKeypad({ onKey, dateLabel, onDatePress }: OdometerKeypadProps) {
  const { t } = useTranslation();
  const digit = (value: OdometerDigit) => (
    <Key
      key={value}
      testID={`key-${value}`}
      accessibilityLabel={value}
      onPress={() => onKey(value)}
    >
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        style={{ fontFamily: HUB_FONT.monoMedium, fontSize: 24, color: hub.text }}
      >
        {value}
      </Text>
    </Key>
  );
  return (
    <View style={{ gap: GAP }}>
      {DIGIT_ROWS.map((row) => (
        <View key={row.join('')} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map(digit)}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: GAP }}>
        <Key testID="key-date" filled={false} accessibilityLabel={dateLabel} onPress={onDatePress}>
          <Text
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontFamily: HUB_FONT.sansMedium, fontSize: 14, color: hub.dim }}
          >
            {dateLabel}
          </Text>
        </Key>
        {digit('0')}
        <Key
          testID="key-delete"
          filled={false}
          accessibilityLabel={t('bikeHub.odometer.deleteA11y')}
          onPress={() => onKey(ODOMETER_KEY.DELETE)}
          onLongPress={() => onKey(ODOMETER_KEY.CLEAR)}
        >
          <Delete size={26} color={hub.text} strokeWidth={2} />
        </Key>
      </View>
    </View>
  );
}
