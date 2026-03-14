import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { HelpCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface WizardOptionChipProps {
  label: string;
  subtitle?: string;
  selected: boolean;
  isIDontKnow?: boolean;
  icon?: ReactNode;
  onPress: () => void;
}

export function WizardOptionChip({
  label,
  subtitle,
  selected,
  isIDontKnow,
  icon,
  onPress,
}: WizardOptionChipProps) {
  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      className={`rounded-2xl p-4 border-2 ${
        isIDontKnow
          ? selected
            ? 'border-neutral-500 bg-neutral-100 dark:bg-neutral-800'
            : 'border-dashed border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-850'
          : selected
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
      }`}
      style={{ borderCurve: 'continuous' }}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <View className="flex-row items-center gap-2">
        {isIDontKnow ? (
          <HelpCircle
            size={18}
            color={selected ? palette.neutral600 : palette.neutral400}
            strokeWidth={1.5}
          />
        ) : icon ? (
          icon
        ) : null}
        <Text
          className={`text-sm font-medium flex-1 ${
            isIDontKnow
              ? selected
                ? 'text-neutral-700 dark:text-neutral-300'
                : 'text-neutral-500 dark:text-neutral-400'
              : selected
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-neutral-700 dark:text-neutral-300'
          }`}
        >
          {label}
        </Text>
      </View>
      {subtitle && (
        <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{subtitle}</Text>
      )}
    </Pressable>
  );
}
