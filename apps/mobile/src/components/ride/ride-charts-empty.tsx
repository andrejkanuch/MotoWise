import { BarChart3, Info } from 'lucide-react-native';
import { memo } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { tint } from '../../theme/editorial';

interface RideChartsEmptyProps {
  theme: {
    ink: string;
    ink2: string;
    ink3: string;
    ink4: string;
    warm: string;
  };
}

export const RideChartsEmpty = memo(function RideChartsEmpty({ theme }: RideChartsEmptyProps) {
  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <View
        style={{
          borderRadius: 18,
          borderCurve: 'continuous',
          padding: 20,
          backgroundColor: tint(theme.ink, 0.03),
          borderWidth: 1,
          borderColor: tint(theme.ink, 0.04),
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: tint(theme.ink, 0.06),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BarChart3 size={18} color={theme.ink3} />
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: theme.ink2,
            textAlign: 'center',
          }}
        >
          Ride analytics unavailable
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 6,
            paddingHorizontal: 8,
          }}
        >
          <Info size={12} color={theme.ink4} style={{ marginTop: 2 }} />
          <Text
            style={{
              fontFamily: 'GeistMono-Regular',
              fontSize: 11,
              lineHeight: 16,
              color: theme.ink4,
              flex: 1,
            }}
          >
            This ride was recorded without detailed GPS tracking. Speed and elevation charts require
            waypoint data collected during the ride.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});
