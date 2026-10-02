import { Text, type TextStyle, View } from 'react-native';
import { HUB_FONT, hub } from './tokens';

const EYEBROW_SIZE = 10;

interface StatProps {
  eyebrow: string;
  value: string;
  /** The period and denominator behind the value ("9 months") — keeps money figures honest. */
  basis?: string;
  valueStyle?: TextStyle;
}

/**
 * Eyebrow · mono value · one-line basis. A stat is never pressable on its own —
 * the card that holds it is.
 */
export function Stat({ eyebrow, value, basis, valueStyle }: StatProps) {
  return (
    <View style={{ flex: 1, gap: 3, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: HUB_FONT.mono,
          fontSize: EYEBROW_SIZE,
          letterSpacing: EYEBROW_SIZE * 0.08,
          textTransform: 'uppercase',
          color: hub.muted,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[{ fontFamily: HUB_FONT.monoMedium, fontSize: 17, color: hub.text }, valueStyle]}
      >
        {value}
      </Text>
      {basis ? (
        <Text
          numberOfLines={1}
          style={{ fontFamily: HUB_FONT.sans, fontSize: 11, color: hub.muted }}
        >
          {basis}
        </Text>
      ) : null}
    </View>
  );
}
