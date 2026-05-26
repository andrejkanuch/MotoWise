import { palette } from '@motovault/design-system';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
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
  totalDistance: number;
  onFollowersTap?: () => void;
  onFollowingTap?: () => void;
}

function StatCard({
  label,
  value,
  onPress,
  isDark,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  isDark: boolean;
}) {
  const content = (
    <View style={{ alignItems: 'center', flex: 1, paddingVertical: 12 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: isDark ? palette.white : palette.neutral950,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: isDark ? palette.neutral400 : palette.neutral500,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          triggerImpact();
          onPress();
        }}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={`${value} ${label}`}
      >
        {content}
      </Pressable>
    );
  }

  return content;
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
  const isDark = useColorScheme() === 'dark';

  const cardBg = isDark ? palette.surfaceElevated : palette.neutral100;
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

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
    { label: t('community.distance'), value: `${formatCompact(totalDistance)} km` },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(50).duration(280)}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {stats.map((stat, index) => (
          <View key={stat.label} style={{ flex: 1, flexDirection: 'row' }}>
            <StatCard
              label={stat.label}
              value={stat.value}
              onPress={stat.onPress}
              isDark={isDark}
            />
            {index < stats.length - 1 && (
              <View
                style={{
                  width: 0.5,
                  alignSelf: 'center',
                  height: '60%',
                  backgroundColor: dividerColor,
                }}
              />
            )}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
