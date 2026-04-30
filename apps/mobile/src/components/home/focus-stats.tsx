import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';
import { ECard } from '../ui/editorial';

interface FocusStatsProps {
  recentRides: {
    startedAt: string;
    distanceM: number | null;
  }[];
}

function WeekBars({ values }: { values: number[] }) {
  const { t: theme } = useEditorialTheme();
  const max = Math.max(...values, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {values.map((v, i) => {
        const h = v === 0 ? 3 : Math.max(10, (v / max) * 70);
        const active = v > 0;
        return (
          <View key={days[i]} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: '100%',
                height: h,
                borderRadius: 4,
                borderCurve: 'continuous',
                backgroundColor: active ? theme.warm : theme.surface2,
                opacity: active ? 1 : 0.7,
              }}
            />
            <Text style={{ fontSize: 10, color: theme.ink3, fontWeight: '500' }}>
              {dayLabels[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function FocusStats({ recentRides }: FocusStatsProps) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const thisMonthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRides = recentRides.filter((r) => new Date(r.startedAt) >= monthStart);
    const distanceKm = Math.round(
      monthRides.reduce((sum, r) => sum + (r.distanceM ?? 0), 0) / 1000,
    );
    return { distanceKm, rideCount: monthRides.length };
  }, [recentRides]);

  const weeklyKm = useMemo(() => {
    const now = new Date();
    const today = now.getDay();
    const mondayOffset = today === 0 ? 6 : today - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const bars = [0, 0, 0, 0, 0, 0, 0];
    for (const ride of recentRides) {
      const rideDate = new Date(ride.startedAt);
      if (rideDate >= monday) {
        const dayIdx = rideDate.getDay() === 0 ? 6 : rideDate.getDay() - 1;
        bars[dayIdx] += Math.round((ride.distanceM ?? 0) / 1000);
      }
    }
    return bars;
  }, [recentRides]);

  return (
    <ECard pad={18}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 10,
              color: theme.ink3,
              marginBottom: 2,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 44,
                color: theme.ink,
                letterSpacing: -0.6,
                lineHeight: 48,
              }}
            >
              {thisMonthStats.distanceKm}
            </Text>
            <Text style={{ fontSize: 13, color: theme.ink3, fontWeight: '500' }}>
              {t('home.monthlyGoalSuffix', { goal: 600 })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontSize: 10,
              color: theme.ink3,
              marginBottom: 2,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {t('home.ridesLabel')}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '600',
              color: theme.ink,
              fontFamily: 'InstrumentSerif-Regular',
            }}
          >
            {thisMonthStats.rideCount}
          </Text>
        </View>
      </View>

      {/* Distance progress */}
      <View style={{ marginTop: 14 }}>
        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: theme.surface2,
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={[theme.warm, theme.warm2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              width: `${Math.min(100, (thisMonthStats.distanceKm / 600) * 100)}%`,
              height: '100%',
              borderRadius: 999,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: 10, color: theme.ink3 }}>0</Text>
          <Text style={{ fontSize: 10, color: theme.ink3 }}>300</Text>
          <Text style={{ fontSize: 10, color: theme.ink3 }}>{t('home.kmGoal', { goal: 600 })}</Text>
        </View>
      </View>

      {/* Weekly sparkline */}
      <View
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: theme.line2,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            {t('home.last7Days')}
          </Text>
          <Text style={{ fontSize: 11, color: theme.ink3 }}>{t('home.kmPerDay')}</Text>
        </View>
        <WeekBars values={weeklyKm} />
      </View>

      {/* Open analytics link */}
      <Pressable
        onPress={() => router.push('/(tabs)/(garage)')}
        style={{ marginTop: 14 }}
      >
        <Text style={{ fontSize: 12, color: theme.warm, fontWeight: '600' }}>
          {t('home.openAnalytics')}
        </Text>
      </Pressable>
    </ECard>
  );
}
