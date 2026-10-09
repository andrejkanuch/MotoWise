import { Text, type TextStyle, View } from 'react-native';
import { HUB_FIGURE_STRONG, SYSTEM_WEIGHT, useHubTheme } from './tokens';

const LABEL_SIZE = 12;

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
 * Label · condensed figure · one-line basis. A stat is never pressable on its own —
 * the card that holds it is.
 */
export function Stat({ eyebrow, value, basis, valueStyle, compact = false }: StatProps) {
  const hub = useHubTheme();
  return (
    <View
      style={{
        flex: 1,
        gap: compact ? 2 : 3,
        paddingVertical: compact ? 0 : 12,
        paddingHorizontal: compact ? 0 : 14,
      }}
    >
      {/* Never truncated: "Per month · 2026" must keep its year. It shrinks a
          little first, then wraps to a second line (long locales). */}
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{
          ...SYSTEM_WEIGHT.medium,
          fontSize: LABEL_SIZE,
          color: hub.dim,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          { ...HUB_FIGURE_STRONG, fontSize: 22, lineHeight: 24, color: hub.text },
          valueStyle,
        ]}
      >
        {value}
      </Text>
      {basis ? (
        <Text
          numberOfLines={1}
          style={{ ...SYSTEM_WEIGHT.regular, fontSize: 11, color: hub.muted }}
        >
          {basis}
        </Text>
      ) : null}
    </View>
  );
}
