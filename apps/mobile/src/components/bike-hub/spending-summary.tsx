import { palette } from '@motovault/design-system';
import { TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface SpendingSummaryProps {
  thisYear: number;
  allTime: number;
  isDark: boolean;
}

export function SpendingSummary({ thisYear, allTime, isDark }: SpendingSummaryProps) {
  const { t } = useTranslation();

  const hasData = allTime > 0;

  if (!hasData) {
    return (
      <Animated.View entering={FadeInUp.duration(300)} style={{ paddingHorizontal: 20 }}>
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 20,
            alignItems: 'center',
          }}
        >
          <TrendingUp size={24} color={palette.neutral400} strokeWidth={1.5} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: isDark ? palette.neutral300 : palette.neutral600,
              marginTop: 8,
            }}
          >
            {t('bikeHub.noExpenses', { defaultValue: 'No expenses recorded' })}
          </Text>
          <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 2 }}>
            {t('bikeHub.startTracking', {
              defaultValue: 'Complete a task with cost to start tracking',
            })}
          </Text>
        </View>
      </Animated.View>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ paddingHorizontal: 20 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.neutral500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        {t('bikeHub.spending', { defaultValue: 'Spending' })}
      </Text>
      <View
        style={{
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          flexDirection: 'row',
          gap: 16,
        }}
      >
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: palette.neutral500, marginBottom: 4 }}>
            {t('bikeHub.thisYear', { defaultValue: 'This Year' })}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '800',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {formatCurrency(thisYear)}
          </Text>
        </View>
        <View
          style={{
            width: 1,
            backgroundColor: isDark ? palette.neutral700 : palette.neutral200,
          }}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: palette.neutral500, marginBottom: 4 }}>
            {t('bikeHub.allTime', { defaultValue: 'All Time' })}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '800',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {formatCurrency(allTime)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
