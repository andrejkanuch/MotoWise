import { Delete } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { ODOMETER_KEY, type OdometerDigit, type OdometerKey } from '@/lib/bike-hub/constants';
import { SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_RADIUS, useHubTheme } from '../ui/tokens';
import { SHEET_LOCKED_OPACITY } from './sheet-header';

const KEY_HEIGHT = 56;
const GAP = 8;
const DIGIT_ROWS: readonly (readonly OdometerDigit[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

// Rows keep their height: a fit-to-contents sheet must size to the keypad, not
// squeeze it.
const ROW = { flexDirection: 'row', gap: GAP, height: KEY_HEIGHT, flexShrink: 0 } as const;

interface KeyProps {
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  filled?: boolean;
  disabled: boolean;
  testID: string;
  children: React.ReactNode;
}

function Key({
  onPress,
  onLongPress,
  accessibilityLabel,
  filled = true,
  disabled,
  testID,
  children,
}: KeyProps) {
  const hub = useHubTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerSelection();
        onPress();
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flex: 1,
        height: KEY_HEIGHT,
        borderRadius: HUB_RADIUS.button,
        borderCurve: 'continuous',
        backgroundColor: filled ? hub.raised : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? SHEET_LOCKED_OPACITY : pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

interface OdometerKeypadProps {
  onKey: (key: OdometerKey) => void;
  /** Locked while the reading saves: the saved value must be the one shown. */
  disabled?: boolean;
}

/**
 * The app's own numeric pad — identical on both platforms, no system keyboard.
 * Bottom row: Clear · 0 · delete (long-press on delete clears too). The date
 * lives in a chip beside the reading, not in the pad.
 */
export function OdometerKeypad({ onKey, disabled = false }: OdometerKeypadProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  const digit = (value: OdometerDigit) => (
    <Key
      key={value}
      testID={`key-${value}`}
      disabled={disabled}
      accessibilityLabel={value}
      onPress={() => onKey(value)}
    >
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        style={[type.figure, { color: hub.text }]}
      >
        {value}
      </Text>
    </Key>
  );
  return (
    <View style={{ gap: GAP }}>
      {DIGIT_ROWS.map((row) => (
        <View key={row.join('')} style={ROW}>
          {row.map(digit)}
        </View>
      ))}
      <View style={ROW}>
        <Key
          testID="key-clear"
          filled={false}
          disabled={disabled}
          accessibilityLabel={t('bikeHub.odometer.clearA11y')}
          onPress={() => onKey(ODOMETER_KEY.CLEAR)}
        >
          <Text
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: hub.dim }]}
          >
            {t('bikeHub.odometer.clear')}
          </Text>
        </Key>
        {digit('0')}
        <Key
          testID="key-delete"
          filled={false}
          disabled={disabled}
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
