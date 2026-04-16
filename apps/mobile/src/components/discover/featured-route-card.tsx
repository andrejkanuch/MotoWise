import { palette } from '@motovault/design-system';
import type { DiscoverRoutesQuery } from '@motovault/graphql';
import { Award, Mountain, Route, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { formatDistance } from '../../utils/ride-formatters';

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

interface FeaturedRouteCardProps {
  route: RouteNode;
  onPress: () => void;
}

export const FeaturedRouteCard = memo(function FeaturedRouteCard({
  route,
  onPress,
}: FeaturedRouteCardProps) {
  const isDark = useColorScheme() === 'dark';
  const system = useMeasurementSystem();

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;

  return (
    <Animated.View entering={FadeInUp.duration(300)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Road of the Week: ${route.name}. ${Math.round(route.distanceM / 1000)} kilometers${route.ratingAvg != null ? `, rated ${route.ratingAvg.toFixed(1)} out of 5` : ''}`}
        accessibilityHint="Opens route details"
        style={({ pressed }) => ({
          backgroundColor: pressed ? (isDark ? palette.neutral800 : palette.neutral100) : cardBg,
          borderWidth: 1,
          borderColor: cardBorder,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 16,
          gap: 12,
        })}
      >
        {/* Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Award size={14} color={palette.signature500} />
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: palette.signature500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Road of the Week
          </Text>
        </View>

        {/* Title */}
        <Text
          numberOfLines={2}
          style={{
            fontSize: 20,
            fontWeight: '800',
            color: titleColor,
            letterSpacing: -0.3,
          }}
        >
          {route.name ?? 'Unnamed Route'}
        </Text>

        {/* Editorial description or fallback */}
        {(route.editorialDescription || route.contributor.displayName) && (
          <Text
            numberOfLines={2}
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: subtitleColor,
            }}
          >
            {route.editorialDescription ??
              `Contributed by ${route.contributor.displayName ?? 'a rider'}`}
          </Text>
        )}

        {/* Stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Route size={13} color={subtitleColor} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: subtitleColor,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatDistance(route.distanceM, system)}
            </Text>
          </View>

          {route.elevationGainM != null && route.elevationGainM > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Mountain size={13} color={subtitleColor} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: subtitleColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatDistance(route.elevationGainM, system)}
              </Text>
            </View>
          )}

          {route.ratingAvg != null && route.ratingCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={13} color={palette.warning500} fill={palette.warning500} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: subtitleColor,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {route.ratingAvg.toFixed(1)} ({route.ratingCount})
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
});
