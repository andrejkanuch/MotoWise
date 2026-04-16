import { palette } from '@motovault/design-system';
import type { DiscoverRoutesQuery } from '@motovault/graphql';
import { Award, Fuel, MessageCircle, Mountain, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { fuelBadgeColor, fuelBadgeLabel } from '../../utils/fuel-range';
import { formatDistance } from '../../utils/ride-formatters';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type RouteNode = DiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

interface RouteCardProps {
  route: RouteNode;
  index: number;
  onPress: () => void;
  fuelStopsRequired?: number;
}

export const RouteCard = memo(function RouteCard({
  route,
  index,
  onPress,
  fuelStopsRequired,
}: RouteCardProps) {
  const isDark = useColorScheme() === 'dark';
  const system = useMeasurementSystem();
  const reducedMotion = useReducedMotion();

  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const surfaceLabel =
    route.surfaceType === 'paved'
      ? 'Paved'
      : route.surfaceType === 'mixed'
        ? 'Mixed'
        : route.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  // MotoVault Pick cards — elevated editorial layout
  if (route.isMotovaultPick) {
    return (
      <Animated.View
        entering={
          reducedMotion
            ? undefined
            : FadeInUp.delay(index * 40 + 20)
                .springify()
                .damping(14)
        }
      >
        <AnimatedPressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Editor's Pick route: ${route.name ?? 'Unnamed route'}`}
          style={({ pressed }) => ({
            backgroundColor: isDark ? palette.cardDark : palette.white,
            borderRadius: 18,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
            padding: 16,
            marginBottom: 14,
            gap: 8,
            shadowColor: palette.signature500,
            shadowOpacity: isDark ? 0.15 : 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          {/* Badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              alignSelf: 'flex-start',
            }}
          >
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

          {/* Title */}
          <Text style={{ fontSize: 17, fontWeight: '700', color: titleColor }} numberOfLines={1}>
            {route.name ?? 'Unnamed Route'}
          </Text>

          {/* Editorial description */}
          {route.editorialDescription && (
            <Text
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: subtitleColor,
              }}
              numberOfLines={2}
            >
              {route.editorialDescription}
            </Text>
          )}

          {/* Inline stats */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 4,
            }}
          >
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

            {route.commentCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MessageCircle size={12} color={subtitleColor} />
                <Text style={{ fontSize: 12, color: subtitleColor }}>{route.commentCount}</Text>
              </View>
            )}

            {fuelStopsRequired != null && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: isDark ? palette.neutral900 : palette.neutral100,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                }}
              >
                <Fuel size={10} color={fuelBadgeColor(fuelStopsRequired)} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: fuelBadgeColor(fuelStopsRequired),
                  }}
                >
                  {fuelBadgeLabel(fuelStopsRequired)}
                </Text>
              </View>
            )}
          </View>

          {/* Contributor */}
          <Text style={{ fontSize: 12, color: subtitleColor }}>
            {route.contributor.displayName}
            {route.contributor.publicUsername ? ` @${route.contributor.publicUsername}` : ''}
          </Text>
        </AnimatedPressable>
      </Animated.View>
    );
  }

  // Regular cards — minimal row layout
  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInUp.delay(index * 40).duration(250)}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Route: ${route.name ?? 'Unnamed route'}`}
        style={({ pressed }) => ({
          backgroundColor: pressed
            ? isDark
              ? palette.neutral800
              : palette.neutral100
            : isDark
              ? palette.cardDark
              : palette.white,
          borderRadius: 14,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: isDark ? palette.surfaceElevated : palette.neutral200,
          padding: 14,
          marginBottom: 10,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        {/* Title */}
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: titleColor, marginBottom: 4 }}
          numberOfLines={1}
        >
          {route.name ?? 'Unnamed Route'}
        </Text>

        {/* Inline stats row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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

          {route.commentCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MessageCircle size={12} color={subtitleColor} />
              <Text style={{ fontSize: 12, color: subtitleColor }}>{route.commentCount}</Text>
            </View>
          )}

          {fuelStopsRequired != null && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                backgroundColor: isDark ? palette.neutral900 : palette.neutral100,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <Fuel size={10} color={fuelBadgeColor(fuelStopsRequired)} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: fuelBadgeColor(fuelStopsRequired),
                }}
              >
                {fuelBadgeLabel(fuelStopsRequired)}
              </Text>
            </View>
          )}
        </View>

        {/* Contributor */}
        <Text style={{ fontSize: 12, color: subtitleColor, marginTop: 4 }}>
          {route.contributor.displayName}
          {route.contributor.publicUsername ? ` @${route.contributor.publicUsername}` : ''}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
});
