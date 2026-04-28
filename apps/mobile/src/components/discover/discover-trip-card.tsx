import { palette } from '@motovault/design-system';
import type { TripTemplatesQuery } from '@motovault/graphql';
import { Award, Bookmark, Clock, Mountain, Route, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useEditorialTheme } from '../../theme/editorial';
import { formatDistance } from '../../utils/ride-formatters';

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: palette.editorialSuccess,
  moderate: palette.editorialDarkWarm,
  challenging: palette.danger500,
  expert: palette.editorialPurple,
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  challenging: 'Challenging',
  expert: 'Expert',
};

interface DiscoverTripCardProps {
  trip: TripNode;
  index: number;
  large?: boolean;
  onPress: () => void;
}

export const DiscoverTripCard = memo(function DiscoverTripCard({
  trip,
  index,
  large = false,
  onPress,
}: DiscoverTripCardProps) {
  const { t } = useEditorialTheme();
  const system = useMeasurementSystem();
  const reducedMotion = useReducedMotion();
  const animDelay = Math.min(index * 40, 300);

  const km = trip.distanceM != null ? Math.round(trip.distanceM / 1000) : null;
  const difficultyColor = DIFFICULTY_COLORS[trip.difficulty] ?? t.ink3;
  const difficultyLabel = DIFFICULTY_LABELS[trip.difficulty] ?? trip.difficulty;
  const surfaceLabel =
    trip.surfaceType === 'paved'
      ? 'Paved'
      : trip.surfaceType === 'mixed'
        ? 'Mixed'
        : trip.surfaceType === 'off_road'
          ? 'Off-road'
          : null;

  const hasCover = !!trip.coverImageUrl;
  const imageHeight = large ? 200 : 140;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.delay(animDelay).springify().damping(14)}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${trip.isMotovaultPick ? "Editor's Pick: " : ''}${trip.title}`}
        style={{
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 18,
          borderCurve: 'continuous',
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {/* Cover image */}
        {hasCover && (
          <View style={{ height: imageHeight, position: 'relative' }}>
            <Image
              source={{ uri: trip.coverImageUrl ?? '' }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />

            {/* MotoVault Pick badge */}
            {trip.isMotovaultPick && (
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: 'rgba(212,136,74,0.95)',
                }}
              >
                <Award size={11} color={palette.editorialDarkBg} strokeWidth={2.2} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: palette.editorialDarkBg,
                  }}
                >
                  Pick
                </Text>
              </View>
            )}

            {/* Country + city tag */}
            {trip.countryCode && (
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: palette.editorialDarkInk,
                    fontWeight: '600',
                  }}
                >
                  {trip.countryCode}
                  {trip.city ? ` · ${trip.city}` : ''}
                </Text>
              </View>
            )}

            {/* Bookmark */}
            <View
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bookmark size={14} color={palette.editorialDarkInk} />
            </View>
          </View>
        )}

        {/* Body */}
        <View style={{ padding: 14, paddingHorizontal: 16, gap: 6 }}>
          {/* Region label */}
          {trip.regionCode && (
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: t.ink3,
              }}
            >
              {trip.regionCode}
            </Text>
          )}

          {/* Pick badge (when no cover) */}
          {!hasCover && trip.isMotovaultPick && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
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
          )}

          {/* Title */}
          <Text
            style={{
              fontFamily: 'InstrumentSerif',
              fontSize: large ? 24 : 19,
              lineHeight: large ? 28 : 23,
              letterSpacing: -0.4,
              color: t.ink,
            }}
            numberOfLines={2}
          >
            {trip.title}
          </Text>

          {/* Description */}
          {trip.description && (
            <Text
              style={{
                fontSize: 12.5,
                lineHeight: 18,
                color: t.ink3,
              }}
              numberOfLines={2}
            >
              {trip.description}
            </Text>
          )}

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 4,
            }}
          >
            {km != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Route size={12} color={t.ink3} />
                <Text
                  style={{
                    fontSize: 11.5,
                    color: t.ink2,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>
                    {formatDistance(trip.distanceM ?? 0, system)}
                  </Text>
                </Text>
              </View>
            )}

            {(trip.elevationGainM ?? 0) > 0 && (
              <>
                <View style={{ width: 1, height: 10, backgroundColor: t.line }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Mountain size={12} color={t.ink3} />
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: t.ink2,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    <Text style={{ fontWeight: '600' }}>
                      +{Math.round(trip.elevationGainM ?? 0)}
                    </Text>
                    m
                  </Text>
                </View>
              </>
            )}

            <View style={{ width: 1, height: 10, backgroundColor: t.line }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={12} color={t.ink3} />
              <Text style={{ fontSize: 11.5, color: t.ink2 }}>
                <Text style={{ fontWeight: '600' }}>
                  {(trip.dayCount ?? 0) > 1
                    ? `${trip.dayCount} days`
                    : `${Math.round((trip.estimatedDurationMinutes ?? 60) / 60)}h`}
                </Text>
              </Text>
            </View>
          </View>

          {/* Footer: rating + difficulty + surface */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              marginTop: 4,
              borderTopWidth: 1,
              borderTopColor: t.line,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {trip.averageRating != null && trip.reviewCount > 0 && (
                <>
                  <Star size={12} color={t.warm} fill={t.warm} />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: t.ink,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {trip.averageRating.toFixed(1)}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: t.ink3 }}>({trip.reviewCount})</Text>
                </>
              )}
              {trip.cloneCount > 0 && (
                <Text style={{ fontSize: 11.5, color: t.ink4, marginLeft: 4 }}>
                  · {trip.cloneCount.toLocaleString()} riders
                </Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {surfaceLabel && (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: t.line,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      color: t.ink2,
                      fontWeight: '500',
                    }}
                  >
                    {surfaceLabel}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: difficultyColor,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '600',
                    color: difficultyColor,
                  }}
                >
                  {difficultyLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});
