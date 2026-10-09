import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { formatDistance, formatDuration } from '../../utils/ride-formatters';

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

const MAX_ROWS = 4;
const ROW_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;
const NO_VALUE = '--';

export function FocusHistory({ rides }: FocusHistoryProps) {
  const { t: theme } = useEditorialTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const system = useMeasurementSystem();

  const card = {
    backgroundColor: theme.surface,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  } as const;

  if (rides.length === 0) {
    return (
      <View style={[card, { padding: space.lg }]}>
        <Text style={[type.subhead, { color: theme.ink3, textAlign: 'center' }]}>
          {t('home.noRidesRecorded')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.sm,
        }}
      >
        <Text accessibilityRole="header" style={[type.label, { color: theme.ink2 }]}>
          {t('home.recentRides')}
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/(profile)/rides')}
          accessibilityRole="link"
          hitSlop={12}
        >
          <Text style={[type.label, { color: theme.warm2 }]}>{t('home.seeAllRides')}</Text>
        </Pressable>
      </View>

      <View style={card}>
        {rides.slice(0, MAX_ROWS).map((ride, i, shown) => {
          const date = new Date(ride.startedAt).toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
          });
          const duration = ride.durationS == null ? NO_VALUE : formatDuration(ride.durationS);
          const speed = ride.avgSpeedMps
            ? ` · ${t('home.avgSpeed', { speed: Math.round(ride.avgSpeedMps * 3.6) })}`
            : '';
          return (
            <View
              key={ride.id}
              style={{
                minHeight: ROW_MIN_HEIGHT,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                borderBottomWidth: i === shown.length - 1 ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: theme.line,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[type.body, { color: theme.ink }]} numberOfLines={1}>
                  {ride.name ?? t('home.defaultRideName')}
                </Text>
                <Text style={[type.caption, { color: theme.ink3 }]} numberOfLines={1}>
                  {`${date} · ${duration}${speed}`}
                </Text>
              </View>
              <Text style={[type.figureSmall, { color: theme.ink }]}>
                {ride.distanceM == null ? NO_VALUE : formatDistance(ride.distanceM, system)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
