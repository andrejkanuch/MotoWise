import { metersToUnit, mileageUnitLabel } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface ProfileStatsProps {
  followerCount: number;
  followingCount: number;
  totalRides: number;
  /** Lifetime distance in metres (PublicRideStats.totalDistance). */
  totalDistance: number;
  onFollowersTap?: () => void;
  onFollowingTap?: () => void;
}

function StatCell({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const { t } = useEditorialTheme();
  const content = (
    <View style={{ alignItems: 'center', paddingVertical: space.sm, minHeight: 48 }}>
      <Text style={[type.figureSmall, { color: t.ink }]}>{value}</Text>
      <Text style={[type.caption, { color: t.ink3, marginTop: 2 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return <View style={{ flex: 1 }}>{content}</View>;

  return (
    <Pressable
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      android_ripple={{ color: tint(t.ink, 0.08) }}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, 0.06) : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      {content}
    </Pressable>
  );
}

export function ProfileStats({
  followerCount,
  followingCount,
  totalRides,
  totalDistance,
  onFollowersTap,
  onFollowingTap,
}: ProfileStatsProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  // Display-only conversion into the viewer's own unit.
  const unit = mileageUnitLabel(useMeasurementSystem());
  const distance = Math.round(metersToUnit(totalDistance, unit));

  const stats = [
    {
      label: t('community.followers'),
      value: formatCompact(followerCount),
      onPress: onFollowersTap,
    },
    {
      label: t('community.following'),
      value: formatCompact(followingCount),
      onPress: onFollowingTap,
    },
    { label: t('community.rides'), value: formatCompact(totalRides) },
    { label: t('community.distance'), value: `${formatCompact(distance)} ${unit}` },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(50).duration(280)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {stats.map((stat, index) => (
          <View key={stat.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <StatCell label={stat.label} value={stat.value} onPress={stat.onPress} />
            {index < stats.length - 1 ? (
              <View
                style={{
                  width: StyleSheet.hairlineWidth,
                  height: '50%',
                  backgroundColor: theme.line,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
