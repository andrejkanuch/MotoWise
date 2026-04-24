import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';
import { ECard } from '../ui/editorial';

interface Ride {
  id: string;
  name: string | null;
  startedAt: string;
  durationS: number | null;
  distanceM: number | null;
  avgSpeedMps: number | null;
  bikeName: string | null;
}

interface FocusHistoryProps {
  rides: Ride[];
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDistance(meters: number | null): string {
  if (meters == null) return '--';
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function FocusHistory({ rides }: FocusHistoryProps) {
  const { t: theme } = useEditorialTheme();
  const router = useRouter();

  if (rides.length === 0) {
    return (
      <ECard pad={16}>
        <Text style={{ fontSize: 13, color: theme.ink3, textAlign: 'center', paddingVertical: 20 }}>
          No rides recorded yet
        </Text>
      </ECard>
    );
  }

  return (
    <ECard pad={0}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: theme.ink3,
          }}
        >
          Recent rides
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/(profile)/rides')}>
          <Text style={{ fontSize: 11, color: theme.warm, fontWeight: '600' }}>See all →</Text>
        </Pressable>
      </View>

      {rides.slice(0, 4).map((ride, i) => (
        <View
          key={ride.id}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: theme.line2,
          }}
        >
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 22,
              color: theme.ink3,
              width: 30,
              textAlign: 'center',
              letterSpacing: -0.4,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: theme.ink,
                letterSpacing: -0.1,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {ride.name ?? 'Ride'}
            </Text>
            <Text style={{ fontSize: 11, color: theme.ink3 }} numberOfLines={1}>
              {formatDate(ride.startedAt)} · {formatDuration(ride.durationS)}
              {ride.avgSpeedMps ? ` · avg ${Math.round(ride.avgSpeedMps * 3.6)} km/h` : ''}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 18,
              color: theme.ink,
              letterSpacing: -0.4,
            }}
          >
            {formatDistance(ride.distanceM)}
          </Text>
        </View>
      ))}
    </ECard>
  );
}
