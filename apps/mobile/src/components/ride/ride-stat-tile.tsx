import type React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { tint } from '../../theme/editorial';
import { radius, type } from '../../theme/type';

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
  /** Primary stat (e.g., distance) — larger figure on a raised fill. Never copper: copper is action only. */
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
  const bg = tint(theme.ink, copper ? 0.08 : 0.04);
  const border = tint(theme.ink, copper ? 0.12 : 0.04);
  const labelColor = theme.ink3;
  const valueColor = theme.ink;
  const unitColor = theme.ink3;

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(250)}
      style={{ flexBasis: '30%', flexGrow: 1 }}
    >
      <View
        style={{
          borderRadius: radius.card,
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
          <Text style={[type.caption, { color: labelColor, flex: trailing ? 1 : undefined }]}>
            {label}
          </Text>
          {trailing}
        </View>
        {badge && <View style={{ position: 'absolute', top: 11, right: 10 }}>{badge}</View>}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
          <Text style={[copper ? type.figure : type.figureSmall, { color: valueColor }]}>
            {value}
          </Text>
          {unit && <Text style={[type.caption, { color: unitColor, marginLeft: 2 }]}>{unit}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}
