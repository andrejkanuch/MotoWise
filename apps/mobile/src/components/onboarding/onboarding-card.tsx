import { Check } from 'lucide-react-native';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { radius, space, type } from '../../theme/type';
import { useOnboardingColors } from './onboarding-colors';

interface OnboardingCardProps<T extends string = string> {
  value: T;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: (value: T) => void;
}

export function OnboardingCard<T extends string>({
  value,
  icon: Icon,
  label,
  subtitle,
  selected,
  onPress,
}: OnboardingCardProps<T>) {
  const oc = useOnboardingColors();
  const handlePress = () => {
    onPress(value);
  };

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={null}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        backgroundColor: selected ? oc.cardBgSelected : oc.cardBg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? oc.warm : oc.cardBorderDefault,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        width: '100%',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          backgroundColor: oc.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={selected ? oc.warm2 : oc.textSecondary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: oc.textPrimary }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[type.subhead, { color: oc.textSecondary, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <Animated.View
          entering={ZoomIn.duration(200)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: oc.warm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={16} color={oc.textOnAccent} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
