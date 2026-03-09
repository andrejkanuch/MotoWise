import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

interface OnboardingCardProps {
  value: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle?: string;
  color: string;
  selected: boolean;
  onPress: (value: string) => void;
}

export function OnboardingCard({
  value,
  icon: Icon,
  label,
  subtitle,
  color,
  selected,
  onPress,
}: OnboardingCardProps) {
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
        backgroundColor: selected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? color : 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        transform: [{ scale: pressed ? 0.97 : 1 }],
        boxShadow: selected ? `0 0 20px ${color}33` : '0 1px 3px rgba(0, 0, 0, 0.2)',
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
        <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
          {label}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14, marginTop: 2 }}
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
          <Check size={16} color="#FFFFFF" />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
