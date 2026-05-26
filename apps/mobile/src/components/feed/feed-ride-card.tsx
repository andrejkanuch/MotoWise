import { palette } from '@motovault/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, MapPin, MessageCircle, Mountain, Route } from 'lucide-react-native';
import { memo } from 'react';
import { Image, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { formatDistance, formatDuration } from '../../utils/ride-formatters';
import { KudosButton } from './kudos-button';

// TODO: Replace with generated type from @motovault/graphql after codegen
export interface FeedRide {
  id: string;
  name?: string | null;
  distanceM: number;
  durationS: number;
  elevationGainM?: number | null;
  aiSummary?: string | null;
  routeThumbnailUri?: string | null;
  kudosCount: number;
  commentCount: number;
  hasKudos: boolean;
  bike?: {
    nickname?: string | null;
    make?: string | null;
    model?: string | null;
  } | null;
  rider: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  };
}

interface FeedRideCardProps {
  ride: FeedRide;
  index: number;
  onPress: () => void;
  onRiderPress: () => void;
  onKudosCountPress?: () => void;
}

export const FeedRideCard = memo(function FeedRideCard({
  ride,
  index,
  onPress,
  onRiderPress,
  onKudosCountPress,
}: FeedRideCardProps) {
  const isDark = useColorScheme() === 'dark';
  const system = useMeasurementSystem();

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;
  const placeholderBg = isDark ? palette.surfaceSubtle : palette.neutral100;
  const placeholderIcon = isDark ? palette.neutral700 : palette.neutral400;
  const avatarBg = isDark ? palette.primary700 : palette.primary200;
  const avatarText = isDark ? palette.primary200 : palette.primary700;
  const summaryColor = isDark ? palette.neutral300 : palette.neutral600;

  const bikeName =
    ride.bike?.nickname ??
    (ride.bike?.make ? `${ride.bike.make} ${ride.bike.model ?? ''}`.trim() : null);
  const hasMap = !!ride.routeThumbnailUri;
  const initial = ride.rider.displayName?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${ride.rider.displayName}'s ride, ${formatDistance(ride.distanceM, system)}`}
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
        {/* Rider header */}
        <Pressable
          onPress={onRiderPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            paddingBottom: 0,
          }}
        >
          {ride.rider.avatarUrl ? (
            <Image
              source={{ uri: ride.rider.avatarUrl }}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: avatarBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: avatarText }}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: titleColor }} numberOfLines={1}>
              {ride.rider.displayName}
            </Text>
            <Text style={{ fontSize: 12, color: subtitleColor }}>
              @{ride.rider.username}
              {bikeName ? ` · ${bikeName}` : ''}
            </Text>
          </View>
        </Pressable>

        {/* Map thumbnail */}
        {hasMap ? (
          <View style={{ height: 120, marginTop: 10, position: 'relative' }}>
            <Image
              source={{ uri: ride.routeThumbnailUri ?? '' }}
              style={{
                width: '100%',
                height: 120,
                backgroundColor: isDark ? palette.neutral900 : palette.neutral200,
              }}
            />
            <LinearGradient
              colors={['transparent', cardBg]}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48 }}
            />
          </View>
        ) : (
          <View
            style={{
              height: 48,
              marginTop: 10,
              backgroundColor: placeholderBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Route size={18} color={placeholderIcon} />
          </View>
        )}

        {/* Content */}
        <View style={{ padding: 14, gap: 8 }}>
          {/* Ride name */}
          {ride.name && (
            <Text style={{ fontSize: 16, fontWeight: '700', color: titleColor }} numberOfLines={1}>
              {ride.name}
            </Text>
          )}

          {/* Stats row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: statColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDistance(ride.distanceM, system)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: statColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDuration(ride.durationS)}
              </Text>
            </View>
            {(ride.elevationGainM ?? 0) > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Mountain size={13} color={palette.accent500} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: statColor,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {Math.round(ride.elevationGainM ?? 0)}m
                </Text>
              </View>
            )}
          </View>

          {/* AI summary */}
          {ride.aiSummary && (
            <Text style={{ fontSize: 13, color: summaryColor, lineHeight: 18 }} numberOfLines={2}>
              {ride.aiSummary}
            </Text>
          )}

          {/* Kudos + Comments row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <KudosButton
              rideId={ride.id}
              kudosCount={ride.kudosCount}
              hasKudos={ride.hasKudos}
              onCountPress={onKudosCountPress}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MessageCircle size={18} color={isDark ? palette.neutral500 : palette.neutral400} />
              {ride.commentCount > 0 && (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? palette.neutral400 : palette.neutral500,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {ride.commentCount}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});
