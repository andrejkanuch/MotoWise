import type React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { tint } from '../../theme/editorial';

interface ThemeTokens {
  ink: string;
  ink3: string;
  warm: string;
}

interface RideStatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  /** Copper accent style for primary stat (e.g., distance) */
  copper?: boolean;
  /** Render in top-right corner (e.g., "PRIVATE" pill) */
  badge?: React.ReactNode;
  /** Render after the label (e.g., info button) */
  trailing?: React.ReactNode;
  /** Stagger animation delay in ms */
  delay?: number;
  theme: ThemeTokens;
}

export function RideStatTile({
  icon,
  label,
  value,
  unit,
  copper,
  badge,
  trailing,
  delay = 0,
  theme,
}: RideStatTileProps) {
  const bg = copper ? tint(theme.warm, 0.1) : tint(theme.ink, 0.04);
  const border = copper ? tint(theme.warm, 0.28) : tint(theme.ink, 0.04);
  const labelColor = copper ? theme.warm : theme.ink3;
  const valueColor = copper ? theme.warm : theme.ink;
  const unitColor = copper ? tint(theme.warm, 0.6) : theme.ink3;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(250)}
      style={{ flexBasis: '30%', flexGrow: 1 }}
    >
      <View
        style={{
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 12,
          paddingBottom: 14,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          minHeight: 76,
          position: 'relative',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {icon}
          <Text
            style={{
              fontFamily: 'GeistMono-SemiBold',
              fontSize: 8.5,
              fontWeight: '600',
              letterSpacing: 1.36,
              textTransform: 'uppercase',
              color: labelColor,
              flex: trailing ? 1 : undefined,
            }}
          >
            {label}
          </Text>
          {trailing}
        </View>
        {badge && <View style={{ position: 'absolute', top: 11, right: 10 }}>{badge}</View>}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              letterSpacing: -0.48,
              fontVariant: ['tabular-nums'],
              color: valueColor,
            }}
          >
            {value}
          </Text>
          {unit && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: unitColor,
                marginLeft: 2,
              }}
            >
              {unit}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
