import { Text, type TextStyle, View } from 'react-native';
import { HUB_FONT, hub } from './tokens';

const EYEBROW_SIZE = 10;

interface StatProps {
  eyebrow: string;
  value: string;
  /** The period and denominator behind the value ("9 months") — keeps money figures honest. */
  basis?: string;
  valueStyle?: TextStyle;
  /** Drops the cell padding when the parent lays the stats out itself. */
  compact?: boolean;
}

/**
 * Eyebrow · mono value · one-line basis. A stat is never pressable on its own —
 * the card that holds it is.
 */
export function Stat({ eyebrow, value, basis, valueStyle, compact = false }: StatProps) {
  return (
    <View
      style={{
        flex: 1,
        gap: compact ? 2 : 3,
        paddingVertical: compact ? 0 : 12,
        paddingHorizontal: compact ? 0 : 14,
      }}
    >
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
