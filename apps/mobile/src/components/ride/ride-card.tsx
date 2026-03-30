import { palette } from '@motovault/design-system';
import type { Ride } from '@motovault/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Gauge, MapPin, Route } from 'lucide-react-native';
import { memo } from 'react';
import { Image, Pressable, Text, useColorScheme, View } from 'react-native';
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
  const isDark = useColorScheme() === 'dark';
  const duration = ride.durationS ?? 0;
  const distance = ride.distanceM ?? 0;
  const avgSpeed = ride.avgSpeedMps ?? 0;
  const rideName = ride.name || ride.bikeName || 'Ride';
  const bikeName = ride.bikeName || 'Quick Ride';
  const hasMap = !!ride.routeThumbnailUri;
  const system = useMeasurementSystem();

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;
  const placeholderBg = isDark ? palette.surfaceSubtle : palette.neutral100;
  const placeholderIcon = isDark ? palette.neutral700 : palette.neutral400;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${rideName}, ${formatDate(ride.startedAt)}, ${formatDistance(distance, system)}, ${formatDuration(duration)}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : cardBg,
          borderRadius: 20,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: cardBorder,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        {/* Map thumbnail — full width top bleed */}
        {hasMap ? (
          <View style={{ height: 120, position: 'relative' }}>
            <Image
              source={{ uri: ride.routeThumbnailUri ?? '' }}
              style={{
                width: '100%',
                height: 120,
                backgroundColor: isDark ? palette.neutral900 : palette.neutral200,
              }}
            />
            {/* Gradient fade to card background */}
            <LinearGradient
              colors={['transparent', cardBg]}
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
          /* No map — subtle placeholder */
          <View
            style={{
              height: 56,
              backgroundColor: placeholderBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Route size={20} color={placeholderIcon} />
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
                style={{ fontSize: 17, fontWeight: '700', color: titleColor }}
                numberOfLines={1}
              >
                {rideName}
              </Text>
              <Text style={{ fontSize: 13, color: subtitleColor }}>
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
                  color: statColor,
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
                  color: statColor,
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
                    color: statColor,
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
