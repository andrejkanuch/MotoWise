import type { Ride } from '@motovault/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Route } from 'lucide-react-native';
import { memo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useEditorialTheme } from '../../theme/editorial';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatRelativeDate,
  formatSpeed,
} from '../../utils/ride-formatters';

interface RideCardProps {
  ride: Ride & { bikeName?: string | null; routeThumbnailUri?: string | null };
  index: number;
  onPress: () => void;
}

export const RideCard = memo(function RideCard({ ride, index, onPress }: RideCardProps) {
  const { t } = useEditorialTheme();
  const duration = ride.durationS ?? 0;
  const distance = ride.distanceM ?? 0;
  const avgSpeed = ride.avgSpeedMps ?? 0;
  const rideName = ride.name || ride.bikeName || 'Ride';
  const hasMap = !!ride.routeThumbnailUri;
  const system = useMeasurementSystem();

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${rideName}, ${formatDate(ride.startedAt)}, ${formatDistance(distance, system)}, ${formatDuration(duration)}`}
        style={({ pressed }) => ({
          backgroundColor: t.surface,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: t.line,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {/* Left: Route thumbnail */}
        <View
          style={{
            width: 72,
            height: 60,
            borderRadius: 10,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          {hasMap ? (
            <Image
              source={{ uri: ride.routeThumbnailUri ?? '' }}
              style={{
                width: 72,
                height: 60,
                backgroundColor: t.surface2,
              }}
            />
          ) : (
            <LinearGradient
              colors={[t.surface2, t.surface3]}
              style={{
                width: 72,
                height: 60,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Route size={18} color={t.ink4} />
            </LinearGradient>
          )}
        </View>

        {/* Center: Ride info */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13.5,
              fontWeight: '600',
              color: t.ink,
              letterSpacing: -0.01 * 13.5,
            }}
          >
            {rideName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              color: t.ink3,
            }}
          >
            {formatRelativeDate(ride.startedAt)} · {formatDuration(duration)}
          </Text>
        </View>

        {/* Right: Distance + avg speed */}
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: t.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatDistance(distance, system)}
          </Text>
          {avgSpeed > 0 && (
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'GeistMono',
                color: t.ink3,
              }}
            >
              {formatSpeed(avgSpeed, system)}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});
