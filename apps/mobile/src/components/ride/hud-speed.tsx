import { palette } from '@motovault/design-system';
import { Text, View } from 'react-native';

import { useRideStore } from '../../stores/ride.store';

/** Night-mode uses amber-red for readability without destroying night vision */

export function HudSpeed() {
  const currentSpeed = useRideStore((s) => s.currentSpeed);
  const isNightMode = useRideStore((s) => s.isNightMode);
  const isPaused = useRideStore((s) => s.status) === 'paused';

  const textColor = isNightMode ? palette.nightText : palette.white;
  const unitColor = isNightMode ? palette.nightText : palette.neutral400;
  const glowColor = isNightMode ? palette.nightGlow : palette.hudGlow;

  return (
    <View
      style={{ alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="text"
      accessibilityLabel={`Current speed: ${Math.round(currentSpeed)} miles per hour`}
    >
      {/* Ambient glow behind speed */}
      <View
        style={{
          position: 'absolute',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: glowColor,
        }}
      />
      <Text
        style={{
          fontSize: 112,
          fontVariant: ['tabular-nums'],
          fontWeight: '200',
          letterSpacing: -4,
          color: textColor,
          lineHeight: 112,
          includeFontPadding: false,
          opacity: isPaused ? 0.35 : 1,
        }}
      >
        {Math.round(currentSpeed)}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: unitColor,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        mph
      </Text>
    </View>
  );
}
