import type { Ride } from '@motovault/types';
import { Trophy } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RideMapThumbnail } from './ride-map-thumbnail';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { RECORD_LABELS } from '../../utils/ride-constants';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDate,
  formatDistance,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
  formatSpeed,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';

interface RideCardProps {
  ride: Ride & { bikeName?: string | null; routeThumbnailUri?: string | null };
  index: number;
  onPress: () => void;
  recordTypes?: string[];
}

export const RideCard = memo(function RideCard({
  ride,
  onPress,
  recordTypes,
}: RideCardProps) {
  const { t } = useEditorialTheme();
  const system = useMeasurementSystem();

  const duration = ride.durationS ?? 0;
  const distance = ride.distanceM ?? 0;
  const avgSpeed = ride.avgSpeedMps ?? 0;
  const elevation = ride.elevationGain ?? 0;
  const rideName = ride.name || ride.bikeName || 'Ride';
  const hasRoute = (!!ride.routePolyline || !!ride.routeThumbnailUri) && distance > 0;

  const hasStats = duration > 0 || avgSpeed > 0 || elevation > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rideName}, ${formatDate(ride.startedAt)}, ${formatDistance(distance, system)}, ${formatDuration(duration)}`}
      style={({ pressed }) => ({
        backgroundColor: t.surface,
        borderRadius: 20,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.line,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Map thumbnail band */}
      {(hasRoute || distance > 0) && (
        <View
          style={{
            width: '100%',
            height: 156,
            borderBottomWidth: 1,
            borderBottomColor: t.line,
          }}
        >
          <RideMapThumbnail
            rideId={ride.id}
            routePolyline={ride.routePolyline}
            style={{ width: '100%', height: 156 }}
          />
        </View>
      )}

      {/* Info section */}
      <View style={{ padding: 12, paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
        {/* Top row: name + distance */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: -0.018 * 16,
                color: t.ink,
                lineHeight: 18,
              }}
            >
              {rideName}
            </Text>
            {/* Date line */}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'GeistMono',
                fontSize: 10,
                fontWeight: '500',
                letterSpacing: 0.1 * 10,
                color: t.ink3,
                textTransform: 'uppercase',
                marginTop: 5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatDate(ride.startedAt)}
            </Text>
          </View>

          {/* Distance */}
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.025 * 22,
                  color: t.ink,
                  fontVariant: ['tabular-nums'],
                  lineHeight: 22,
                }}
              >
                {formatDistanceValue(distance, system)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: t.ink3,
                  letterSpacing: -0.01 * 12,
                  marginLeft: 2,
                }}
              >
                {distanceUnitLabel(system)}
              </Text>
            </View>
          </View>
        </View>

        {/* Meta row — inline stats */}
        {hasStats && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderTopColor: t.line,
              flexWrap: 'wrap',
            }}
          >
            {duration > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9.5,
                    fontWeight: '500',
                    letterSpacing: 0.16 * 9.5,
                    textTransform: 'uppercase',
                    color: t.ink3,
                  }}
                >
                  DUR
                </Text>
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 10.5,
                    fontWeight: '600',
                    letterSpacing: 0.05 * 10.5,
                    color: t.ink,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatDuration(duration)}
                </Text>
              </View>
            )}

            {duration > 0 && avgSpeed > 0 && (
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 99,
                  backgroundColor: t.ink4,
                }}
              />
            )}

            {avgSpeed > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9.5,
                    fontWeight: '500',
                    letterSpacing: 0.16 * 9.5,
                    textTransform: 'uppercase',
                    color: t.ink3,
                  }}
                >
                  AVG
                </Text>
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 10.5,
                    fontWeight: '600',
                    letterSpacing: 0.05 * 10.5,
                    color: t.ink,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatSpeedValue(avgSpeed, system)} {speedUnitLabel(system)}
                </Text>
              </View>
            )}

            {(duration > 0 || avgSpeed > 0) && elevation > 0 && (
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 99,
                  backgroundColor: t.ink4,
                }}
              />
            )}

            {elevation > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9.5,
                    fontWeight: '500',
                    letterSpacing: 0.16 * 9.5,
                    textTransform: 'uppercase',
                    color: t.ink3,
                  }}
                >
                  ELEV
                </Text>
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 10.5,
                    fontWeight: '600',
                    letterSpacing: 0.05 * 10.5,
                    color: t.ink,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatElevationValue(elevation, system)} {elevationUnitLabel(system)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Record badges */}
        {recordTypes && recordTypes.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: -2 }}>
            {recordTypes.map((rt) => (
              <View
                key={rt}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  paddingLeft: 6,
                  borderRadius: 99,
                  borderCurve: 'continuous',
                  backgroundColor: tint(t.warm, 0.14),
                  borderWidth: 1,
                  borderColor: tint(t.warm, 0.32),
                }}
              >
                <Trophy size={10} color={t.warm} />
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9.5,
                    fontWeight: '600',
                    letterSpacing: 0.1 * 9.5,
                    textTransform: 'uppercase',
                    color: t.warm,
                  }}
                >
                  {RECORD_LABELS[rt] ?? rt}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
});
