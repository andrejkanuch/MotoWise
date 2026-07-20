import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

const LABEL_STYLE = {
  fontSize: 10,
  fontWeight: '600' as const,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  marginBottom: 4,
};

const VALUE_STYLE = {
  fontSize: 18,
  fontWeight: '600' as const,
  letterSpacing: -0.4,
  fontVariant: ['tabular-nums' as const],
};

/**
 * Three-up stats row for the bike hub: lifetime cost-per-distance-unit, ride
 * count, and a tappable Analytics card that opens the expense dashboard. Money
 * renders in the user's display currency.
 */
export function BikeStatsRow({
  motorcycleId,
  currentMileage,
  mileageUnit,
  ytdTotal,
  ridesCount,
  delay = 120,
}: {
  motorcycleId: string;
  currentMileage?: number | null;
  mileageUnit: string;
  ytdTotal: number;
  ridesCount: number;
  delay?: number;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { format: formatCurrency } = useCurrency();

  const cardStyle = {
    flex: 1,
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: theme.line,
  };

  const costPerUnit =
    currentMileage && ytdTotal > 0 ? formatCurrency(ytdTotal / currentMileage) : '—';

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(300)}
      style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 16 }}
    >
      <View style={cardStyle}>
        <Text style={{ ...LABEL_STYLE, color: theme.ink3 }}>
          {t('bikeHub.costPerUnit', {
            defaultValue: 'COST / {{unit}}',
            unit: mileageUnit.toUpperCase(),
          })}
        </Text>
        <Text style={{ ...VALUE_STYLE, color: theme.ink }}>{costPerUnit}</Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ ...LABEL_STYLE, color: theme.ink3 }}>
          {t('bikeHub.rides', { defaultValue: 'RIDES' })}
        </Text>
        <Text style={{ ...VALUE_STYLE, color: theme.ink }}>{ridesCount}</Text>
      </View>

      <Pressable
        onPress={() => {
          triggerImpact();
          const href: Href = {
            pathname: '/(tabs)/(garage)/expense-dashboard',
            params: {
              motorcycleId,
              currentMileage: currentMileage ? String(currentMileage) : '',
              mileageUnit,
            },
          };
          router.push(href);
        }}
        style={cardStyle}
      >
        <Text style={{ ...LABEL_STYLE, color: theme.ink3 }}>
          {t('bikeHub.analytics', { defaultValue: 'ANALYTICS' })}
        </Text>
        <Text style={{ ...VALUE_STYLE, color: theme.warm }}>{t('bikeHub.viewAnalytics')}</Text>
      </Pressable>
    </Animated.View>
  );
}
