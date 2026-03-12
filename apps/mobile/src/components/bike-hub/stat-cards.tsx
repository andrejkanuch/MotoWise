import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Calendar, DollarSign } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface StatCardsProps {
  upcomingCount: number;
  overdueCount: number;
  totalSpend: number | null; // null means no data
  isDark: boolean;
  onUpcomingPress?: () => void;
  onOverduePress?: () => void;
  onSpendPress?: () => void;
}

export function StatCards({
  upcomingCount,
  overdueCount,
  totalSpend,
  isDark,
  onUpcomingPress,
  onOverduePress,
  onSpendPress,
}: StatCardsProps) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('bikeHub.upcoming', { defaultValue: 'Upcoming' }),
      value: String(upcomingCount),
      icon: Calendar,
      color: palette.primary500,
      isAlert: false,
      onPress: onUpcomingPress,
    },
    {
      label: t('bikeHub.overdue', { defaultValue: 'Overdue' }),
      value: String(overdueCount),
      icon: AlertTriangle,
      color: overdueCount > 0 ? palette.danger500 : palette.neutral400,
      isAlert: overdueCount > 0,
      onPress: onOverduePress,
    },
    {
      label: t('bikeHub.totalSpend', { defaultValue: 'Spend' }),
      value: totalSpend != null ? `$${totalSpend.toFixed(0)}` : '\u2014',
      icon: DollarSign,
      color: palette.success500,
      isAlert: false,
      onPress: onSpendPress,
    },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
      {cards.map((card, index) => (
        <Animated.View
          key={card.label}
          entering={FadeInUp.delay(index * 50).duration(300)}
          style={{ flex: 1 }}
        >
          <Pressable
            onPress={() => {
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              card.onPress?.();
            }}
            style={{
              backgroundColor: card.isAlert
                ? isDark
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(239,68,68,0.08)'
                : isDark
                  ? palette.neutral800
                  : palette.white,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 14,
              alignItems: 'center',
              gap: 6,
              minHeight: 80,
              justifyContent: 'center',
            }}
          >
            <card.icon size={18} color={card.color} strokeWidth={2} />
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: card.isAlert
                  ? palette.danger500
                  : isDark
                    ? palette.neutral50
                    : palette.neutral950,
              }}
            >
              {card.value}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: palette.neutral500,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              {card.label}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
