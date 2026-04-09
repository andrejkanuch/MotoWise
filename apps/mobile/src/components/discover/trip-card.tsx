import { palette } from '@motovault/design-system';
import { Calendar, MapPin, Users } from 'lucide-react-native';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface TripCardProps {
  trip: {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    difficulty: string;
    participantCount: number;
    maxRiders: number;
    organiser: { displayName: string; avatarUrl?: string };
  };
  index: number;
  onPress: () => void;
}

const DIFFICULTY_COLORS = {
  easy: palette.success500,
  moderate: palette.warning500,
  challenging: palette.danger500,
  expert: palette.danger700,
} as const;

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) return s.toLocaleDateString(undefined, opts);
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export function TripCard({ trip, index, onPress }: TripCardProps) {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? palette.cardDark : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtextColor = isDark ? palette.neutral400 : palette.neutral500;
  const diffColor =
    DIFFICULTY_COLORS[trip.difficulty as keyof typeof DIFFICULTY_COLORS] ?? palette.neutral500;

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(250)}>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: cardBg,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 12,
          gap: 10,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Title + difficulty badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{ flex: 1, fontSize: 17, fontWeight: '700', color: titleColor }}
            numberOfLines={1}
          >
            {trip.title}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: diffColor,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.white }}>
              {trip.difficulty.charAt(0).toUpperCase() + trip.difficulty.slice(1)}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text style={{ fontSize: 13, color: subtextColor, lineHeight: 18 }} numberOfLines={2}>
          {trip.description}
        </Text>

        {/* Meta row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Calendar size={14} color={subtextColor} />
            <Text style={{ fontSize: 12, color: subtextColor }}>
              {formatDateRange(trip.startDate, trip.endDate)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={14} color={subtextColor} />
            <Text style={{ fontSize: 12, color: subtextColor }}>
              {trip.participantCount}/{trip.maxRiders}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={14} color={subtextColor} />
            <Text style={{ fontSize: 12, color: subtextColor }}>
              by {trip.organiser.displayName}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
