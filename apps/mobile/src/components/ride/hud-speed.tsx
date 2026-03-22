import { Text, View } from 'react-native';
import { useRideStore } from '../../stores/ride.store';

export function HudSpeed() {
  const currentSpeed = useRideStore((s) => s.currentSpeed);
  const isNightMode = useRideStore((s) => s.isNightMode);

  const textColor = isNightMode ? '#CC0000' : '#FFFFFF';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: 96,
          fontVariant: ['tabular-nums'],
          fontFamily: 'Courier',
          fontWeight: '700',
          color: textColor,
          lineHeight: 96,
          includeFontPadding: false,
        }}
      >
        {Math.round(currentSpeed)}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '500',
          color: textColor,
          opacity: 0.7,
          marginTop: 4,
        }}
      >
        mph
      </Text>
    </View>
  );
}
