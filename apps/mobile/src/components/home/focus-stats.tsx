import { addDays, startOfISOWeek } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { distanceUnitLabel } from '../../utils/ride-formatters';

interface FocusStatsProps {
  recentRides: {
    startedAt: string;
    distanceM: number | null;
  }[];
}

const DISTANCE_UNIT = { KM: 'km', MI: 'mi' } as const;
type DistanceUnit = (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];

/** Ride distances are GPS metres; they are converted for display only. */
const METERS_PER_UNIT: Record<DistanceUnit, number> = {
  [DISTANCE_UNIT.KM]: 1000,
  [DISTANCE_UNIT.MI]: 1609.344,
};
/** The monthly goal as a round number in each unit (600 km ≈ 373 mi → 400 mi). */
const MONTHLY_GOAL: Record<DistanceUnit, number> = {
  [DISTANCE_UNIT.KM]: 600,
  [DISTANCE_UNIT.MI]: 400,
};
const BAR_TRACK_HEIGHT = 72;
const BAR_MIN_HEIGHT = 8;
const BAR_EMPTY_HEIGHT = 4;
const PROGRESS_HEIGHT = 6;
const DAYS_IN_WEEK = 7;

function WeekBars({ values }: { values: number[] }) {
  const { t: theme } = useEditorialTheme();
  const { i18n } = useTranslation();
  const max = Math.max(...values, 1);
  // Narrow weekday initials in the rider's language, Monday first.
  const dayLabels = useMemo(() => {
    const monday = startOfISOWeek(new Date());
    return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
      const day = addDays(monday, i);
      return {
        key: day.toISOString(),
        label: day.toLocaleDateString(i18n.language, { weekday: 'narrow' }),
      };
    });
  }, [i18n.language]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: space.xs,
        height: BAR_TRACK_HEIGHT + space.lg,
      }}
    >
      {values.map((v, i) => {
        const h =
          v === 0 ? BAR_EMPTY_HEIGHT : Math.max(BAR_MIN_HEIGHT, (v / max) * BAR_TRACK_HEIGHT);
        return (
          <View key={dayLabels[i].key} style={{ flex: 1, alignItems: 'center', gap: space.xxs }}>
            <View
              style={{
                width: '100%',
                height: h,
                borderRadius: radius.chip / 2,
                borderCurve: 'continuous',
                backgroundColor: v > 0 ? theme.ink2 : theme.surface3,
              }}
            />
            <Text style={[type.caption, { color: theme.ink3 }]} maxFontSizeMultiplier={1.4}>
              {dayLabels[i].label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function FocusStats({ recentRides }: FocusStatsProps) {
  const { t: theme } = useEditorialTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const unit: DistanceUnit =
    distanceUnitLabel(useMeasurementSystem()) === DISTANCE_UNIT.MI
      ? DISTANCE_UNIT.MI
      : DISTANCE_UNIT.KM;
  const metersPerUnit = METERS_PER_UNIT[unit];
  const goal = MONTHLY_GOAL[unit];

  const thisMonthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRides = recentRides.filter((r) => new Date(r.startedAt) >= monthStart);
    const distance = Math.round(
      monthRides.reduce((sum, r) => sum + (r.distanceM ?? 0), 0) / metersPerUnit,
    );
    return { distance, rideCount: monthRides.length };
  }, [recentRides, metersPerUnit]);

  const weeklyDistance = useMemo(() => {
    const monday = startOfISOWeek(new Date());
    const bars = Array<number>(DAYS_IN_WEEK).fill(0);
    for (const ride of recentRides) {
      const rideDate = new Date(ride.startedAt);
      if (rideDate >= monday) {
        const dayIdx = rideDate.getDay() === 0 ? 6 : rideDate.getDay() - 1;
        bars[dayIdx] += (ride.distanceM ?? 0) / metersPerUnit;
      }
    }
    return bars.map(Math.round);
  }, [recentRides, metersPerUnit]);

  const monthLabel = new Date().toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: space.md,
        gap: space.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: space.sm,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={[type.label, { color: theme.ink3 }]}>{monthLabel}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
            <Text style={[type.figure, { color: theme.ink }]}>{thisMonthStats.distance}</Text>
            <Text style={[type.label, { color: theme.ink3 }]}>
              {t('home.monthlyGoalOf', { goal, unit })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.label, { color: theme.ink3 }]}>{t('home.ridesLabel')}</Text>
          <Text style={[type.figure, { color: theme.ink }]}>{thisMonthStats.rideCount}</Text>
        </View>
      </View>

      {/* Distance progress toward the monthly goal */}
      <View style={{ gap: space.xxs }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: goal, now: thisMonthStats.distance }}
          style={{
            height: PROGRESS_HEIGHT,
            borderRadius: PROGRESS_HEIGHT,
            backgroundColor: theme.surface3,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.min(100, (thisMonthStats.distance / goal) * 100)}%`,
              height: '100%',
              backgroundColor: theme.ink2,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[type.caption, { color: theme.ink3, fontVariant: ['tabular-nums'] }]}>
            0
          </Text>
          <Text style={[type.caption, { color: theme.ink3, fontVariant: ['tabular-nums'] }]}>
            {t('home.distanceGoal', { goal, unit })}
          </Text>
        </View>
      </View>

      {/* Weekly bars */}
      <View
        style={{
          paddingTop: space.md,
          borderTopWidth: 1,
          borderTopColor: theme.line2,
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
          <Text style={[type.label, { color: theme.ink2 }]}>{t('home.last7Days')}</Text>
          <Text style={[type.caption, { color: theme.ink3 }]}>
            {t('home.distancePerDay', { unit })}
          </Text>
        </View>
        <WeekBars values={weeklyDistance} />
      </View>

      <Pressable
        onPress={() => router.push('/(tabs)/(garage)')}
        accessibilityRole="link"
        hitSlop={12}
        style={{ alignSelf: 'flex-start' }}
      >
        <Text style={[type.label, { color: theme.warm2 }]}>{t('home.openAnalytics')}</Text>
      </Pressable>
    </View>
  );
}
