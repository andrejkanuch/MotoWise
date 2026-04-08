import { palette } from '@motovault/design-system';
import type { DiscoverRoutesQuery } from '@motovault/graphql';
import { Award, MessageCircle, Mountain, Route, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { formatDistance } from '../../utils/ride-formatters';

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

interface RouteCardProps {
  route: RouteNode;
  index: number;
  onPress: () => void;
}

export const RouteCard = memo(function RouteCard({ route, index, onPress }: RouteCardProps) {
  const isDark = useColorScheme() === 'dark';
  const system = useMeasurementSystem();

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;
  const badgeBg = isDark ? palette.accent900 : palette.accent50;
  const badgeText = isDark ? palette.accent300 : palette.accent700;

  const surfaceLabel =
    route.surfaceType === 'paved'
      ? 'Paved'
      : route.surfaceType === 'mixed'
        ? 'Mixed'
        : route.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(250)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Route: ${route.name ?? 'Unnamed route'}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: cardBorder,
          padding: 14,
          marginBottom: 10,
          gap: 8,
        })}
      >
        {/* Header row: name + badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Route size={16} color={palette.accent500} />
          <Text
            style={{ flex: 1, fontSize: 15, fontWeight: '700', color: titleColor }}
            numberOfLines={1}
          >
            {route.name ?? 'Unnamed Route'}
          </Text>
          {route.isMotovaultPick && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                backgroundColor: badgeBg,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <Award size={12} color={badgeText} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: badgeText }}>Pick</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: statColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatDistance(route.distanceM, system)}
          </Text>

          {(route.elevationGainM ?? 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Mountain size={12} color={palette.accent500} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: statColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {Math.round(route.elevationGainM ?? 0)}m
              </Text>
            </View>
          )}

          {surfaceLabel && (
            <Text style={{ fontSize: 12, color: subtitleColor }}>{surfaceLabel}</Text>
          )}

          {/* Rating */}
          {route.ratingAvg != null && route.ratingCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={12} color={palette.warning500} fill={palette.warning500} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: statColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {route.ratingAvg.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 11, color: subtitleColor }}>({route.ratingCount})</Text>
            </View>
          )}

          {/* Comment count */}
          {route.commentCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MessageCircle size={12} color={subtitleColor} />
              <Text style={{ fontSize: 12, color: subtitleColor }}>{route.commentCount}</Text>
            </View>
          )}
        </View>

        {/* Contributor */}
        <Text style={{ fontSize: 12, color: subtitleColor }}>
          by {route.contributor.displayName}
          {route.contributor.publicUsername ? ` @${route.contributor.publicUsername}` : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
