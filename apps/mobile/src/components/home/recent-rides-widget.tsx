import { palette } from '@motovault/design-system';
import type { Ride } from '@motovault/types';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin, Navigation, Route } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import {
  distanceUnitLabel,
  formatDistance,
  formatDistanceValue,
  formatDuration,
  formatRelativeDate,
} from '../../utils/ride-formatters';

interface RecentRidesWidgetProps {
  rides: Array<Ride & { bikeName?: string | null; routeThumbnailUri?: string | null }>;
  totalDistanceM: number;
  totalRides: number;
  isDark: boolean;
}

/** Weekly activity dots — shows which of the last 7 days had rides */
function WeeklyActivityDots({ rides }: { rides: Array<{ startedAt: string }> }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const rideDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of rides) {
      const d = new Date(r.startedAt);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return set;
  }, [rides]);

  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {days.map((day) => {
        const hasRide = rideDays.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`);
        const isToday = day.toDateString() === today.toDateString();
        const dayLabel = day.toLocaleDateString(undefined, { weekday: 'narrow' });

        return (
          <View key={day.toISOString()} style={{ alignItems: 'center', gap: 3 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: '600',
                color: isToday ? palette.white : palette.neutral500,
              }}
            >
              {dayLabel}
            </Text>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                borderCurve: 'continuous',
                backgroundColor: hasRide ? palette.accent500 : palette.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {hasRide && <Navigation size={8} color={palette.white} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function RecentRidesWidget({
  rides,
  totalDistanceM,
  totalRides,
  isDark,
}: RecentRidesWidgetProps) {
  const router = useRouter();
  const system = useMeasurementSystem();
  const recentRides = rides.slice(0, 3);
  const totalDistanceFormatted = formatDistanceValue(totalDistanceM, system);
  const unitLabel = distanceUnitLabel(system);

  if (recentRides.length === 0) {
    return (
      <Animated.View entering={FadeInUp.duration(280)}>
        <View
          style={{
            backgroundColor: isDark ? palette.cardDark : palette.white,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.accentTintSubtle : palette.accentTintLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Navigation size={24} color={palette.accent500} />
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: isDark ? palette.white : palette.neutral900,
            }}
          >
            Start your first ride
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: palette.neutral400,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            Tap the ride button to begin tracking your route, speed, and distance.
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(280)}>
      <View
        style={{
          backgroundColor: isDark ? palette.cardDark : palette.white,
          borderRadius: 20,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
          overflow: 'hidden',
        }}
      >
        {/* Header with weekly stats */}
        <View style={{ padding: 16, gap: 16 }}>
          {/* Title + See All */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Route size={18} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: isDark ? palette.white : palette.neutral900,
                }}
              >
                Recent Rides
              </Text>
            </View>
            <Pressable
              onPress={() =>
                // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
                router.push('/(tabs)/(profile)/rides' as any)
              }
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityRole="button"
              accessibilityLabel="See all rides"
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
                See All
              </Text>
              <ChevronRight size={14} color={palette.accent500} />
            </Pressable>
          </View>

          {/* This week stats strip */}
          <View
            style={{
              backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral50,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 14,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: palette.neutral500,
                  letterSpacing: 0.5,
                }}
              >
                THIS WEEK
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: palette.neutral400 }}>
                {totalRides} ride{totalRides !== 1 ? 's' : ''}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: isDark ? palette.white : palette.neutral900,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {totalDistanceFormatted}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.neutral400 }}>
                  {unitLabel}
                </Text>
              </View>
            </View>
            <WeeklyActivityDots rides={rides} />
          </View>
        </View>

        {/* Recent rides list */}
        {recentRides.map((ride) => {
          const distance = ride.distanceM ?? 0;
          const duration = ride.durationS ?? 0;
          const name = ride.name || ride.bikeName || 'Ride';

          return (
            <Pressable
              key={ride.id}
              onPress={() => {
                const route = {
                  pathname: '/(modals)/ride-detail' as const,
                  params: { rideId: ride.id },
                };
                // biome-ignore lint/suspicious/noExplicitAny: expo-router does not export typed route params
                router.push(route as any);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${formatRelativeDate(ride.startedAt)}, ${formatDistance(distance, system)}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
                backgroundColor: pressed
                  ? isDark
                    ? palette.surfaceSubtle
                    : palette.neutral50
                  : 'transparent',
                borderTopWidth: 1,
                borderTopColor: isDark ? palette.surfaceElevated : palette.neutral100,
              })}
            >
              {/* Mini route indicator */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPin size={16} color={palette.accent500} />
              </View>

              {/* Info */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: isDark ? palette.white : palette.neutral900,
                  }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: palette.neutral400,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatDistance(distance, system)}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.neutral500 }}>·</Text>
                  <Text style={{ fontSize: 13, color: palette.neutral400 }}>
                    {formatDuration(duration)}
                  </Text>
                </View>
              </View>

              {/* Date */}
              <Text style={{ fontSize: 12, color: palette.neutral500 }}>
                {formatRelativeDate(ride.startedAt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}
