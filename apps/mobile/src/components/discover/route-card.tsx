import { palette } from '@motovault/design-system';
import type { DiscoverRoutesQuery } from '@motovault/graphql';
import { Award, Fuel, MessageCircle, Mountain, Star } from 'lucide-react-native';
import { memo, useCallback, useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { fuelBadgeColor, fuelBadgeLabel } from '../../utils/fuel-range';
import { formatDistance } from '../../utils/ride-formatters';

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

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.controlBg : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;
  const surfaceLabel =
    route.surfaceType === 'paved'
      ? 'Paved'
      : route.surfaceType === 'mixed'
        ? 'Mixed'
        : route.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  const animDelay = Math.min(index * 40, 300);

  // MotoVault Pick cards — elevated editorial layout
  if (route.isMotovaultPick) {
    return (
      <Animated.View
        entering={
          reducedMotion
            ? undefined
            : FadeInUp.delay(animDelay + 20)
                .springify()
                .damping(14)
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
          accessibilityLabel={`Editor's Pick route: ${route.name ?? 'Unnamed route'}`}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
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
        </Pressable>
      </Animated.View>
    );
  }

  // Regular cards
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
        accessibilityLabel={`Route: ${route.name ?? 'Unnamed route'}`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {/* Title */}
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: titleColor, marginBottom: 8 }}
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
        <Text style={{ fontSize: 12, color: subtitleColor, marginTop: 8 }}>
          {route.contributor.displayName}
          {route.contributor.publicUsername ? ` @${route.contributor.publicUsername}` : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
