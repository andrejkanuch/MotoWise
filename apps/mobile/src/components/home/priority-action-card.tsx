import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';
import type { PriorityAction } from './home-types';

interface PriorityActionCardProps {
  action: PriorityAction;
  isDark: boolean;
}

export function PriorityActionCard({ action, isDark }: PriorityActionCardProps) {
  const Icon = action.icon;
  const pulseScale = useSharedValue(1);
  const isOverdue = action.type === 'overdue';
  const isSolidCta = isOverdue || action.type === 'upcoming';

  useEffect(() => {
    if (isOverdue) {
      pulseScale.value = withRepeat(withTiming(1.05, { duration: 1000 }), -1, true);
    }
  }, [isOverdue, pulseScale]);

  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View entering={FadeInUp.delay(120).duration(300)}>
      <CardWrapper tier="medium" style={{ overflow: 'hidden' }}>
        {/* Top accent strip */}
        <View
          style={{
            height: 3,
            backgroundColor: action.accentColor,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        />
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') {
              if (isOverdue) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
            action.onPress();
          }}
          style={{ padding: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Animated.View
              style={[
                {
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: `${action.accentColor}25`,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                isOverdue ? iconPulseStyle : undefined,
              ]}
            >
              <Icon size={22} color={action.accentColor} strokeWidth={1.8} />
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                }}
                numberOfLines={1}
              >
                {action.title}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  opacity: 0.6,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {action.subtitle}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              action.onPress();
            }}
            style={{
              backgroundColor: isSolidCta ? action.accentColor : `${action.accentColor}15`,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingVertical: 14,
              paddingHorizontal: 16,
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: isSolidCta ? palette.white : action.accentColor,
              }}
            >
              {action.ctaLabel}
            </Text>
          </Pressable>
        </Pressable>
      </CardWrapper>
    </Animated.View>
  );
}
