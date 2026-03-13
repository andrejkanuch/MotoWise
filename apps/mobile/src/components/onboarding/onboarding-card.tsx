import { Check } from 'lucide-react-native';
import type React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from './onboarding-colors';

interface OnboardingCardProps<T extends string = string> {
  value: T;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle?: string;
  color: string;
  selected: boolean;
  onPress: (value: T) => void;
}

export function OnboardingCard<T extends string>({
  value,
  icon: Icon,
  label,
  subtitle,
  color,
  selected,
  onPress,
}: OnboardingCardProps<T>) {
  const handlePress = () => {
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
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        transform: [{ scale: pressed ? 0.97 : 1 }],
        ...(selected
          ? {
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              ...(Platform.OS === 'android' ? { elevation: 4 } : {}),
            }
          : {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
            }),
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: `${color}22`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ color: ONBOARDING_COLORS.textPrimary, fontSize: 17, fontWeight: '600' }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              color: ONBOARDING_COLORS.textSecondary,
              fontSize: 14,
              marginTop: 2,
            }}
          >
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
          <Check size={16} color={ONBOARDING_COLORS.textPrimary} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
