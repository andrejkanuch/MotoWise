import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';

interface ChipDef<K extends string> {
  key: K;
  label: string;
  icon?: LucideIcon;
  emoji?: string;
}

interface FilterChipRowProps<K extends string> {
  chips: ReadonlyArray<ChipDef<K>>;
  activeKeys: ReadonlySet<K>;
  onToggle: (key: K) => void;
  accessibilityGroupLabel?: string;
}

function FilterChipRowInner<K extends string>({
  chips,
  activeKeys,
  onToggle,
  accessibilityGroupLabel,
}: FilterChipRowProps<K>) {
  const isDark = useColorScheme() === 'dark';
  const chipBg = isDark ? palette.neutral800 : palette.neutral100;
  const chipText = isDark ? palette.neutral200 : palette.neutral700;

  const handlePress = useCallback(
    (key: K) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onToggle(key);
    },
    [onToggle],
  );

  return (
    <View accessibilityRole="toolbar" accessibilityLabel={accessibilityGroupLabel ?? 'Filters'}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {chips.map((chip) => {
          const isActive = activeKeys.has(chip.key);
          const Icon = chip.icon;
          return (
            <Pressable
              key={chip.key}
              onPress={() => handlePress(chip.key)}
              accessibilityRole="button"
              accessibilityLabel={`${isActive ? 'Remove' : 'Add'} ${chip.label} filter`}
              accessibilityState={{ selected: isActive }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: isActive ? palette.accent500 : chipBg,
              }}
            >
              {Icon && <Icon size={14} color={isActive ? palette.white : chipText} />}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isActive ? palette.white : chipText,
                }}
              >
                {chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const FilterChipRow = memo(FilterChipRowInner) as typeof FilterChipRowInner;
