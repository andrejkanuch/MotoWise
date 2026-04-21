import { palette } from '@motovault/design-system';
import type { DiscoverTripsQuery } from '@motovault/graphql';
import { Award, Calendar, Copy, Mountain, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { formatDistance } from '../../utils/ride-formatters';

type TripNode = DiscoverTripsQuery['discoverTrips']['edges'][number]['node'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: palette.success500,
  moderate: palette.accent500,
  challenging: palette.warning500,
  expert: palette.danger500,
};

interface DiscoverTripCardProps {
  trip: TripNode;
  index: number;
  onPress: () => void;
}

export const DiscoverTripCard = memo(function DiscoverTripCard({
  trip,
  index,
  onPress,
}: DiscoverTripCardProps) {
  const isDark = useColorScheme() === 'dark';
  const system = useMeasurementSystem();
  const reducedMotion = useReducedMotion();

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.controlBg : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const difficultyColor = DIFFICULTY_COLORS[trip.difficulty] ?? palette.accent500;
  const animDelay = Math.min(index * 40, 300);

  const surfaceLabel =
    trip.surfaceType === 'paved'
      ? 'Paved'
      : trip.surfaceType === 'mixed'
        ? 'Mixed'
        : trip.surfaceType === 'off_road'
          ? 'Off-road'
          : null;

  // MotoVault Pick — elevated card
  if (trip.isMotovaultPick) {
    return (
      <Animated.View
        entering={
          reducedMotion ? undefined : FadeInUp.delay(animDelay + 20).springify().damping(14)
        }
        style={{
          backgroundColor: cardBg,
          borderRadius: 18,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: cardBorder,
          padding: 16,
          marginBottom: 14,
          gap: 10,
          shadowColor: palette.signature500,
          shadowOpacity: isDark ? 0.2 : 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        }}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Editor's Pick: ${trip.title}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}>
            <Award size={13} color={palette.signature500} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: palette.signature500,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Editor's Pick
            </Text>
          </View>

          <Text style={{ fontSize: 17, fontWeight: '700', color: titleColor }} numberOfLines={1}>
            {trip.title}
          </Text>

          <Text style={{ fontSize: 13, lineHeight: 18, color: subtitleColor }} numberOfLines={2}>
            {trip.description}
          </Text>

          <TripStats
            trip={trip}
            system={system}
            statColor={statColor}
            subtitleColor={subtitleColor}
            difficultyColor={difficultyColor}
            surfaceLabel={surfaceLabel}
          />

          <ContributorLine contributor={trip.contributor} subtitleColor={subtitleColor} />
        </Pressable>
      </Animated.View>
    );
  }

  // Regular card
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.delay(animDelay).duration(250)}
      style={{
        backgroundColor: cardBg,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: cardBorder,
        padding: 16,
        marginBottom: 12,
        shadowColor: palette.neutral950,
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Trip: ${trip.title}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {/* Title + day count badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: titleColor, flex: 1 }} numberOfLines={1}>
            {trip.title}
          </Text>
          {trip.dayCount > 1 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                backgroundColor: palette.accent500,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
                borderCurve: 'continuous',
              }}
            >
              <Calendar size={10} color={palette.white} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: palette.white }}>
                {trip.dayCount}d
              </Text>
            </View>
          )}
        </View>

        <TripStats
          trip={trip}
          system={system}
          statColor={statColor}
          subtitleColor={subtitleColor}
          difficultyColor={difficultyColor}
          surfaceLabel={surfaceLabel}
        />

        <ContributorLine contributor={trip.contributor} subtitleColor={subtitleColor} />
      </Pressable>
    </Animated.View>
  );
});

// --- Shared stat row ---

function TripStats({
  trip,
  system,
  statColor,
  subtitleColor,
  difficultyColor,
  surfaceLabel,
}: {
  trip: TripNode;
  system: ReturnType<typeof import('../../hooks/use-measurement-system').useMeasurementSystem>;
  statColor: string;
  subtitleColor: string;
  difficultyColor: string;
  surfaceLabel: string | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      {/* Difficulty chip */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: difficultyColor,
          textTransform: 'capitalize',
        }}
      >
        {trip.difficulty}
      </Text>

      {/* Distance */}
      {trip.distanceM != null && (
        <Text
          style={{ fontSize: 13, fontWeight: '600', color: statColor, fontVariant: ['tabular-nums'] }}
        >
          {formatDistance(trip.distanceM, system)}
        </Text>
      )}

      {/* Elevation */}
      {(trip.elevationGainM ?? 0) > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Mountain size={12} color={palette.accent500} />
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: statColor, fontVariant: ['tabular-nums'] }}
          >
            {Math.round(trip.elevationGainM ?? 0)}m
          </Text>
        </View>
      )}

      {/* Surface */}
      {surfaceLabel && <Text style={{ fontSize: 12, color: subtitleColor }}>{surfaceLabel}</Text>}

      {/* Rating */}
      {trip.averageRating != null && trip.reviewCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Star size={12} color={palette.warning500} fill={palette.warning500} />
          <Text
            style={{ fontSize: 12, fontWeight: '600', color: statColor, fontVariant: ['tabular-nums'] }}
          >
            {trip.averageRating.toFixed(1)}
          </Text>
          <Text style={{ fontSize: 11, color: subtitleColor }}>({trip.reviewCount})</Text>
        </View>
      )}

      {/* Clone count */}
      {trip.cloneCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Copy size={11} color={subtitleColor} />
          <Text style={{ fontSize: 12, color: subtitleColor }}>{trip.cloneCount}</Text>
        </View>
      )}
    </View>
  );
}

// --- Contributor line ---

function ContributorLine({
  contributor,
  subtitleColor,
}: {
  contributor: TripNode['contributor'];
  subtitleColor: string;
}) {
  if (!contributor) return null;
  return (
    <Text style={{ fontSize: 12, color: subtitleColor, marginTop: 8 }}>
      {contributor.displayName}
      {contributor.publicUsername ? ` @${contributor.publicUsername}` : ''}
    </Text>
  );
}
