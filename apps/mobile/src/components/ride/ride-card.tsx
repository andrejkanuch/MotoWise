import { palette } from '@motovault/design-system';
import type { Ride } from '@motovault/types';
import { Clock, MapPin } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface RideCardProps {
  ride: Ride & { bikeName?: string | null; routeThumbnailUri?: string | null };
  index: number;
  onPress: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RideCard({ ride, index, onPress }: RideCardProps) {
  const duration = ride.durationS ?? 0;
  const distance = ride.distanceM ?? 0;
  const bikeName = ride.bikeName || 'Quick Ride';

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          backgroundColor: pressed ? palette.neutral800 : palette.neutral900,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 14,
          gap: 12,
          alignItems: 'center',
        })}
      >
        {/* Route thumbnail */}
        {ride.routeThumbnailUri ? (
          <Image
            source={{ uri: ride.routeThumbnailUri }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: palette.neutral800,
            }}
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: palette.neutral800,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={24} color={palette.neutral600} />
          </View>
        )}

        {/* Details */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{ fontSize: 15, fontWeight: '600', color: palette.white }}
            numberOfLines={1}
          >
            {bikeName}
          </Text>
          <Text style={{ fontSize: 13, color: palette.neutral400 }}>
            {formatDate(ride.startedAt)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} color={palette.neutral500} />
              <Text style={{ fontSize: 13, fontWeight: '500', color: palette.neutral300 }}>
                {formatDistance(distance)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={palette.neutral500} />
              <Text style={{ fontSize: 13, fontWeight: '500', color: palette.neutral300 }}>
                {formatDuration(duration)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
