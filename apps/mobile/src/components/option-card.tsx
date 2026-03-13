import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from './onboarding/onboarding-colors';

interface OptionCardProps<T extends string> {
  value: T;
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  subtitle?: string;
  color: string;
  selected: boolean;
  onPress: (value: T) => void;
}

export function OptionCard<T extends string>({
  value,
  icon: Icon,
  title,
  subtitle,
  color,
  selected,
  onPress,
}: OptionCardProps<T>) {
  const handlePress = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(value);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        backgroundColor: selected ? ONBOARDING_COLORS.cardBgSelected : ONBOARDING_COLORS.cardBg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? color : ONBOARDING_COLORS.cardBorderDefault,
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        boxShadow: selected ? `0 0 20px ${color}33` : '0 1px 3px rgba(0, 0, 0, 0.2)',
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: `${color}22`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={26} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: ONBOARDING_COLORS.textPrimary, fontSize: 17, fontWeight: '600' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: ONBOARDING_COLORS.textSecondary, fontSize: 14, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <Animated.View
          entering={ZoomIn.duration(200).springify()}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={16} color={palette.white} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
