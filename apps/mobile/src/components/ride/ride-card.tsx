import { palette } from '@motovault/design-system';
import type { Ride } from '@motovault/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Gauge, MapPin, Route } from 'lucide-react-native';
import { memo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
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
  const duration = ride.durationS ?? 0;
  const distance = ride.distanceM ?? 0;
  const avgSpeed = ride.avgSpeedMps ?? 0;
  const rideName = ride.name || ride.bikeName || 'Ride';
  const bikeName = ride.bikeName || 'Quick Ride';
  const hasMap = !!ride.routeThumbnailUri;
  const system = useMeasurementSystem();

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${rideName}, ${formatDate(ride.startedAt)}, ${formatDistance(distance, system)}, ${formatDuration(duration)}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? palette.neutral800 : palette.cardDark,
          borderRadius: 20,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: palette.surfaceElevated,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        {/* Map thumbnail — full width top bleed */}
        {hasMap ? (
          <View style={{ height: 120, position: 'relative' }}>
            <Image
              source={{ uri: ride.routeThumbnailUri ?? '' }}
              style={{ width: '100%', height: 120, backgroundColor: palette.neutral900 }}
            />
            {/* Gradient fade to card background */}
            <LinearGradient
              colors={['transparent', palette.cardDark]}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 48,
              }}
            />
          </View>
        ) : (
          /* No map — subtle topographic pattern placeholder */
          <View
            style={{
              height: 56,
              backgroundColor: palette.surfaceSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Route size={20} color={palette.neutral700} />
          </View>
        )}

        {/* Content */}
        <View style={{ padding: 16, gap: 8 }}>
          {/* Title row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{ fontSize: 17, fontWeight: '700', color: palette.white }}
                numberOfLines={1}
              >
                {rideName}
              </Text>
              <Text style={{ fontSize: 13, color: palette.neutral400 }}>
                {formatRelativeDate(ride.startedAt)} · {bikeName}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginTop: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: palette.neutral200,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDistance(distance, system)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Clock size={13} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: palette.neutral200,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDuration(duration)}
              </Text>
            </View>
            {avgSpeed > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Gauge size={13} color={palette.accent500} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: palette.neutral200,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatSpeed(avgSpeed, system)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});
