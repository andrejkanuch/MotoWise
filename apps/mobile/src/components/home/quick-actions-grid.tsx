import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';
import type { QuickAction } from './home-types';

interface QuickActionsGridProps {
  actions: QuickAction[];
  isDark: boolean;
  onActionPress: (route: string) => void;
}

export function QuickActionsGrid({ actions, isDark, onActionPress }: QuickActionsGridProps) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(180).duration(300)}>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          flexWrap: actions.length > 3 ? 'wrap' : undefined,
        }}
      >
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Animated.View
              key={action.key}
              entering={FadeInUp.delay(200 + index * 60).duration(300)}
              style={{ flex: 1, minWidth: actions.length > 3 ? '22%' : undefined }}
            >
              <CardWrapper tier="medium">
                <Pressable
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios')
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onActionPress(action.route);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 18,
                      borderCurve: 'continuous',
                      backgroundColor: isDark ? action.bgDark : action.bgLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Icon size={24} color={action.color} strokeWidth={1.6} />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: isDark ? palette.neutral50 : palette.neutral950,
                      textAlign: 'center',
                    }}
                    numberOfLines={2}
                  >
                    {t(action.titleKey as never)}
                  </Text>
                </Pressable>
              </CardWrapper>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}
