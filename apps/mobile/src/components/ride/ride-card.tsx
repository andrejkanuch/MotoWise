import type { Ride } from '@motovault/types';
import { Trophy } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useEditorialTheme } from '../../theme/editorial';
import { radius, type } from '../../theme/type';
import { RECORD_LABELS } from '../../utils/ride-constants';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDate,
  formatDistance,
  formatDistanceValue,
  formatDuration,
  formatElevationValue,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';
import { RideMapThumbnail } from './ride-map-thumbnail';

interface RideCardProps {
  ride: Ride & { bikeName?: string | null; routeThumbnailUri?: string | null };
  index: number;
  onPress: () => void;
  recordTypes?: string[];
}

export const RideCard = memo(function RideCard({ ride, onPress, recordTypes }: RideCardProps) {
  const { t } = useEditorialTheme();
  const { t: i18n } = useTranslation();
  const system = useMeasurementSystem();

  const duration = ride.durationS ?? 0;
  const distance = ride.distanceM ?? 0;
  const avgSpeed = ride.avgSpeedMps ?? 0;
  const elevation = ride.elevationGain ?? 0;
  const rideName = ride.name || ride.bikeName || i18n('common.ride');
  const hasRoute = (!!ride.routePolyline || !!ride.routeThumbnailUri) && distance > 0;

  const hasStats = duration > 0 || avgSpeed > 0 || elevation > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rideName}, ${formatDate(ride.startedAt)}, ${formatDistance(distance, system)}, ${formatDuration(duration)}`}
      style={({ pressed }) => ({
        backgroundColor: t.surface,
        borderRadius: radius.plate,
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
            routeThumbnailUri={ride.routeThumbnailUri}
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
            <Text numberOfLines={1} style={[type.bodyStrong, { color: t.ink }]}>
              {rideName}
            </Text>
            {/* Date line */}
            <Text numberOfLines={1} style={[type.caption, { color: t.ink3, marginTop: 2 }]}>
              {formatDate(ride.startedAt)}
            </Text>
          </View>

          {/* Distance */}
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[type.figure, { color: t.ink }]}>
                {formatDistanceValue(distance, system)}
              </Text>
              <Text style={[type.caption, { color: t.ink3, marginLeft: 2 }]}>
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
              borderTopColor: t.line,
              flexWrap: 'wrap',
            }}
          >
            {duration > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[type.caption, { color: t.ink3 }]}>{i18n('myRides.dur')}</Text>
                <Text style={[type.label, { color: t.ink, fontVariant: ['tabular-nums'] }]}>
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
                <Text style={[type.caption, { color: t.ink3 }]}>Avg</Text>
                <Text style={[type.label, { color: t.ink, fontVariant: ['tabular-nums'] }]}>
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
                <Text style={[type.caption, { color: t.ink3 }]}>Elev</Text>
                <Text style={[type.label, { color: t.ink, fontVariant: ['tabular-nums'] }]}>
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
                  backgroundColor: t.surface2,
                  borderWidth: 1,
                  borderColor: t.line,
                }}
              >
                <Trophy size={10} color={t.ink2} />
                <Text style={[type.caption, { color: t.ink2 }]}>{RECORD_LABELS[rt] ?? rt}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
});
