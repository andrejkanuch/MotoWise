import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Heart, Sparkles, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';

interface EmptyStateProps {
  isDark: boolean;
  onAddBike: () => void;
  onExplore: () => void;
}

export function EmptyState({ isDark, onAddBike, onExplore }: EmptyStateProps) {
  const { t } = useTranslation();

  const valueCards = [
    {
      icon: Heart,
      title: t('home.emptyValueHealth'),
      subtitle: t('home.emptyValueHealthDesc'),
      color: palette.danger500,
    },
    {
      icon: Wrench,
      title: t('home.emptyValueMaintenance'),
      subtitle: t('home.emptyValueMaintenanceDesc'),
      color: palette.warning500,
    },
    {
      icon: Sparkles,
      title: t('home.emptyValueAI'),
      subtitle: t('home.emptyValueAIDesc'),
      color: palette.primary500,
    },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(50).duration(300)}>
      {valueCards.map((card, index) => {
        const CardIcon = card.icon;
        return (
          <Animated.View
            key={card.title}
            entering={FadeInUp.delay(100 + index * 100).duration(300)}
            style={{ marginBottom: 10 }}
          >
            <CardWrapper tier="subtle">
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: `${card.color}18`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CardIcon size={22} color={card.color} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: isDark ? palette.neutral50 : palette.neutral950,
                    }}
                  >
                    {card.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: isDark ? palette.neutral400 : palette.neutral500,
                      marginTop: 2,
                    }}
                  >
                    {card.subtitle}
                  </Text>
                </View>
              </View>
            </CardWrapper>
          </Animated.View>
        );
      })}

      {/* Primary CTA */}
      <Animated.View entering={FadeInUp.delay(400).duration(300)}>
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddBike();
          }}
          accessibilityRole="button"
          style={{
            backgroundColor: palette.primary700,
            borderRadius: 20,
            borderCurve: 'continuous',
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: palette.white, fontSize: 16, fontWeight: '700' }}>
            {t('home.emptyAddBike')}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Secondary CTA */}
      <Animated.View entering={FadeInUp.delay(450).duration(300)}>
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onExplore();
          }}
          accessibilityRole="button"
          style={{ alignItems: 'center', marginTop: 14 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: palette.primary500,
            }}
          >
            {t('home.emptyExploreWithout')}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
