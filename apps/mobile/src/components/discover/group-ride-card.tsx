import { palette } from '@motovault/design-system';
import type { GetGroupRidesQuery } from '@motovault/graphql';
import { Calendar, MapPin, Users } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

type GroupRideNode = GetGroupRidesQuery['getGroupRides']['edges'][number]['node'];

interface GroupRideCardProps {
  groupRide: GroupRideNode;
  index: number;
  onPress: () => void;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} \u00b7 ${time}`;
}

const DIFFICULTY_COLORS = {
  easy: { bg: palette.successBgLight, bgDark: palette.successBgDark, text: palette.success500 },
  moderate: { bg: palette.warningBgLight, bgDark: palette.warningBgDark, text: palette.warning500 },
  challenging: { bg: palette.dangerBgLight, bgDark: palette.dangerBgDark, text: palette.danger500 },
} as const;

export const GroupRideCard = memo(function GroupRideCard({
  groupRide,
  index,
  onPress,
}: GroupRideCardProps) {
  const isDark = useColorScheme() === 'dark';

  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const statColor = isDark ? palette.neutral200 : palette.neutral700;
  const pressedBg = isDark ? palette.neutral800 : palette.neutral100;

  const difficultyKey = (
    groupRide.difficulty ?? 'easy'
  ).toLowerCase() as keyof typeof DIFFICULTY_COLORS;
  const difficultyStyle = DIFFICULTY_COLORS[difficultyKey] ?? DIFFICULTY_COLORS.easy;
  const difficultyLabel = difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1);

  const isFull = groupRide.status === 'full';
  const riderLabel = `${groupRide.participantCount}/${groupRide.maxRiders} riders`;
  const fillRatio = groupRide.maxRiders > 0 ? groupRide.participantCount / groupRide.maxRiders : 0;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(250)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Group ride: ${groupRide.title}`}
        style={({ pressed }) => ({
          backgroundColor: pressed ? pressedBg : cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: cardBorder,
          padding: 14,
          width: 260,
          marginRight: 12,
          gap: 8,
        })}
      >
        {/* Type badge */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            alignSelf: 'flex-start',
            backgroundColor: palette.signature500,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderCurve: 'continuous',
          }}
        >
          <Users size={10} color={palette.white} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.white }}>Group Ride</Text>
        </View>

        {/* Header row: title + badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{ flex: 1, fontSize: 15, fontWeight: '700', color: titleColor }}
            numberOfLines={1}
          >
            {groupRide.title}
          </Text>
          {isFull && (
            <View
              style={{
                backgroundColor: isDark ? palette.dangerBgDark : palette.dangerBgLight,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: palette.danger500 }}>
                Full
              </Text>
            </View>
          )}
        </View>

        {/* Date & meeting point */}
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Calendar size={12} color={palette.accent500} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: statColor }}>
              {formatDateTime(groupRide.dateTime)}
            </Text>
          </View>
          {groupRide.meetingPointName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={subtitleColor} />
              <Text style={{ fontSize: 12, color: subtitleColor }} numberOfLines={1}>
                {groupRide.meetingPointName}
              </Text>
            </View>
          )}
        </View>

        {/* Difficulty badge + rider count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              backgroundColor: isDark ? difficultyStyle.bgDark : difficultyStyle.bg,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              borderCurve: 'continuous',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: difficultyStyle.text }}>
              {difficultyLabel}
            </Text>
          </View>

          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Users size={12} color={subtitleColor} />
            <View
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.min(fillRatio * 100, 100)}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: isFull ? palette.danger500 : palette.accent500,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: subtitleColor,
                fontVariant: ['tabular-nums'],
              }}
            >
              {riderLabel}
            </Text>
          </View>
        </View>

        {/* Organiser */}
        <Text style={{ fontSize: 12, color: subtitleColor }}>
          by {groupRide.organiser.displayName}
          {groupRide.organiser.publicUsername ? ` @${groupRide.organiser.publicUsername}` : ''}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
