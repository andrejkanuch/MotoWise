import { palette } from '@motovault/design-system';
import type { TripTemplatesQuery } from '@motovault/graphql';
import { Image } from 'expo-image';
import { Award, Bookmark, Clock, Mountain, Route, Star } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { type EditorialTokens, tint, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { formatDistance } from '../../utils/ride-formatters';

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

/** Difficulty → theme token. Display only, so never copper (copper is action). */
export const DIFFICULTY_TOKEN = {
  easy: 'success',
  moderate: 'dueInk',
  challenging: 'danger',
  expert: 'purple',
} as const satisfies Record<string, keyof EditorialTokens>;

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
  const { t: i18n } = useTranslation();
  const system = useMeasurementSystem();
  const reducedMotion = useReducedMotion();
  const animDelay = Math.min(index * 40, 300);

  const km = trip.distanceM != null ? Math.round(trip.distanceM / 1000) : null;
  const difficultyToken =
    DIFFICULTY_TOKEN[trip.difficulty as keyof typeof DIFFICULTY_TOKEN] ?? null;
  const difficultyColor = difficultyToken ? t[difficultyToken] : t.ink3;
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
          borderRadius: radius.card,
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
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              recyclingKey={trip.id}
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
                  backgroundColor: t.plateReady,
                }}
              >
                <Award size={12} color={t.onPlate} strokeWidth={2.2} />
                <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: t.onPlate }]}>
                  {i18n('discover.pick')}
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
                  backgroundColor: tint(palette.plateG0, 0.72),
                }}
              >
                <Text style={[type.caption, SYSTEM_WEIGHT.medium, { color: palette.plateInk }]}>
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
                backgroundColor: tint(palette.plateG0, 0.72),
                borderWidth: 1,
                borderColor: palette.plateLineDark,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bookmark size={14} color={palette.plateInk} />
            </View>
          </View>
        )}

        {/* Body */}
        <View style={{ padding: 14, paddingHorizontal: 16, gap: 6 }}>
          {/* Pick badge (when no cover) */}
          {!hasCover && trip.isMotovaultPick && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Award size={13} color={t.ink2} />
              <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: t.ink2 }]}>
                {i18n('discover.editorsPick')}
              </Text>
            </View>
          )}

          {/* Title */}
          <Text style={[type.sectionTitle, { color: t.ink }]} numberOfLines={2}>
            {trip.title}
          </Text>

          {/* Region */}
          {trip.regionCode && (
            <Text style={[type.caption, { color: t.ink3 }]}>{trip.regionCode}</Text>
          )}

          {/* Description */}
          {trip.description && (
            <Text style={[type.subhead, { color: t.ink3 }]} numberOfLines={2}>
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
                <Text style={[type.figureSmall, { color: t.ink }]}>
                  {formatDistance(trip.distanceM ?? 0, system)}
                </Text>
              </View>
            )}

            {(trip.elevationGainM ?? 0) > 0 && (
              <>
                <View style={{ width: 1, height: 10, backgroundColor: t.line }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Mountain size={12} color={t.ink3} />
                  <Text style={[type.figureSmall, { color: t.ink }]}>
                    +{Math.round(trip.elevationGainM ?? 0)}
                    {i18n('discover.metersUnit')}
                  </Text>
                </View>
              </>
            )}

            {/* Duration/days: only render when we have a real value — never
                fabricate "1h" for dateless showcases. Divider rides with the
                chip so no orphan separator is left behind (cf. elevation). */}
            {((trip.dayCount ?? 0) > 0 || trip.estimatedDurationMinutes != null) && (
              <>
                <View style={{ width: 1, height: 10, backgroundColor: t.line }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} color={t.ink3} />
                  <Text style={[type.figureSmall, { color: t.ink }]}>
                    {trip.dayCount != null && trip.dayCount > 1
                      ? `${trip.dayCount} days`
                      : trip.estimatedDurationMinutes != null
                        ? `${Math.round(trip.estimatedDurationMinutes / 60)}h`
                        : `${trip.dayCount} day`}
                  </Text>
                </View>
              </>
            )}
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
                  <Star size={12} color={t.ink2} fill={t.ink2} />
                  <Text
                    style={[
                      type.label,
                      SYSTEM_WEIGHT.semibold,
                      { color: t.ink, fontVariant: ['tabular-nums'] },
                    ]}
                  >
                    {trip.averageRating.toFixed(1)}
                  </Text>
                  <Text style={[type.label, { color: t.ink3 }]}>({trip.reviewCount})</Text>
                </>
              )}
              {trip.cloneCount > 0 && (
                <Text style={[type.label, { color: t.ink3, marginLeft: space.xxs }]}>
                  {i18n('discover.ridersCount', { riders: trip.cloneCount.toLocaleString() })}
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
                    backgroundColor: t.surface2,
                    borderWidth: 1,
                    borderColor: t.line,
                  }}
                >
                  <Text style={[type.caption, { color: t.ink2 }]}>{surfaceLabel}</Text>
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
                <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: difficultyColor }]}>
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
