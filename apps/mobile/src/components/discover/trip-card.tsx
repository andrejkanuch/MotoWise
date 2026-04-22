import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Calendar, MapPin } from 'lucide-react-native';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TripCardProps {
  trip: {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    difficulty: string;
    waypoints?: { id: string; lat: number; lng: number }[] | null;
  };
  index: number;
  onPress: () => void;
}

// Four distinct difficulty hues — expert is purple, not a duplicate red.
const DIFFICULTY_COLORS = {
  easy: palette.success500,
  moderate: palette.warning500,
  challenging: palette.danger500,
  expert: palette.signature500,
} as const;

// Riderly difficulty labels — replaces generic "Moderate/Challenging".
const DIFFICULTY_LABELS = {
  easy: 'Chill',
  moderate: 'Spirited',
  challenging: 'Technical',
  expert: 'Expert',
} as const;

function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function TripCard({ trip, index, onPress }: TripCardProps) {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? palette.cardDark : palette.white;
  const cardBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const bodyColor = isDark ? palette.neutral300 : palette.neutral600;
  const metaColor = isDark ? palette.neutral300 : palette.neutral500;

  const diffKey = (trip.difficulty || 'easy').toLowerCase() as keyof typeof DIFFICULTY_COLORS;
  const diffColor = DIFFICULTY_COLORS[diffKey] ?? palette.neutral500;
  const diffLabel = DIFFICULTY_LABELS[diffKey] ?? 'Chill';

  const days = dayCount(trip.startDate, trip.endDate);
  const stopCount = trip.waypoints?.length ?? 0;

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 120 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 160 });
  };
  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const a11yLabel = `${trip.title}, a ${diffLabel.toLowerCase()} ${days}-day trip with ${stopCount} ${stopCount === 1 ? 'stop' : 'stops'}.`;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(250)}>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Opens trip details"
        style={[
          {
            width: 296,
            minHeight: 196,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: cardBorder,
            padding: 14,
            marginRight: 12,
            gap: 10,
          },
          pressStyle,
        ]}
      >
        {/* Badge row — difficulty only (visibility, completeness ring hidden for seeded data) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flex: 1 }} />

          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: diffColor,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.white }}>
              {diffLabel}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: '800',
            color: titleColor,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {trip.title}
        </Text>

        {/* Description (single line, filler only) */}
        {trip.description ? (
          <Text style={{ fontSize: 13, color: bodyColor, lineHeight: 18 }} numberOfLines={1}>
            {trip.description}
          </Text>
        ) : null}

        {/* Stats strip — days + stops only (riders hidden for seeded data) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginTop: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Calendar size={12} color={palette.accent500} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: titleColor }}>
              {days}
              <Text style={{ fontWeight: '500', color: metaColor }}>d</Text>
            </Text>
          </View>
          {stopCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} color={palette.accent500} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: titleColor }}>
                {stopCount}
                <Text style={{ fontWeight: '500', color: metaColor }}>
                  {stopCount === 1 ? ' stop' : ' stops'}
                </Text>
              </Text>
            </View>
          )}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
