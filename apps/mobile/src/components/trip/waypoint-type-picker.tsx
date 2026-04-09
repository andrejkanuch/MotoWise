import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  Circle,
  Flag,
  Fuel,
  Moon,
  Mountain,
  Ship,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react-native';
import { Pressable, ScrollView, Text, useColorScheme } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const WAYPOINT_TYPES = [
  { key: 'start', label: 'Start', Icon: Flag, color: palette.success500 },
  { key: 'end', label: 'End', Icon: Circle, color: palette.danger500 },
  { key: 'fuel', label: 'Fuel', Icon: Fuel, color: palette.warning500 },
  { key: 'food', label: 'Food', Icon: UtensilsCrossed, color: palette.accent500 },
  { key: 'scenic', label: 'Scenic', Icon: Camera, color: palette.primary500 },
  { key: 'overnight', label: 'Overnight', Icon: Moon, color: palette.primary700 },
  { key: 'photo', label: 'Photo', Icon: Camera, color: palette.accent400 },
  { key: 'mechanical', label: 'Mechanic', Icon: Wrench, color: palette.neutral500 },
  { key: 'ferry', label: 'Ferry', Icon: Ship, color: palette.primary400 },
  { key: 'pass_summit', label: 'Pass', Icon: Mountain, color: palette.neutral600 },
  { key: 'rally_point', label: 'Rally', Icon: Users, color: palette.signature500 },
] as const;

export function getWaypointIcon(type: string) {
  return WAYPOINT_TYPES.find((t) => t.key === type) ?? WAYPOINT_TYPES[0];
}

export function WaypointTypePicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (type: string) => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const chipBg = isDark ? palette.neutral800 : palette.neutral200;

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {WAYPOINT_TYPES.map((wt) => {
          const isSelected = wt.key === selected;
          return (
            <Pressable
              key={wt.key}
              onPress={() => {
                onSelect(wt.key);
                if (process.env.EXPO_OS === 'ios')
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={{
                alignItems: 'center',
                gap: 4,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: isSelected ? wt.color : chipBg,
                opacity: isSelected ? 1 : 0.7,
              }}
            >
              <wt.Icon size={20} color={isSelected ? palette.white : wt.color} />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: isSelected
                    ? palette.white
                    : isDark
                      ? palette.neutral300
                      : palette.neutral600,
                }}
              >
                {wt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

export { WAYPOINT_TYPES };
