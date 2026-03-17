import { palette } from '@motovault/design-system';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { formatCurrency } from '../../lib/expense-constants';

interface SummaryCardsProps {
  ytdTotal: number;
  allTimeTotal: number;
  previousYearTotal: number;
  expenseCount: number;
  currentMileage: number | null;
  mileageUnit: string | null;
  motorcycleId: string;
}

export const SummaryCards = memo(function SummaryCards({
  ytdTotal,
  allTimeTotal,
  previousYearTotal,
  expenseCount,
  currentMileage,
  mileageUnit,
  motorcycleId,
}: SummaryCardsProps) {
  const router = useRouter();

  const yoyChange =
    previousYearTotal > 0 ? ((ytdTotal - previousYearTotal) / previousYearTotal) * 100 : null;

  const costPerMile = currentMileage && currentMileage > 0 ? allTimeTotal / currentMileage : null;

  const unitLabel = mileageUnit === 'km' ? 'Cost/km' : 'Cost/mi';

  const cards: Array<{
    label: string;
    value: string;
    badge?: { text: string; positive: boolean } | null;
    action?: () => void;
    actionLabel?: string;
  }> = [
    {
      label: 'YTD Spending',
      value: formatCurrency(ytdTotal),
      badge:
        yoyChange !== null
          ? {
              text: `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}% YoY`,
              positive: yoyChange <= 0,
            }
          : null,
    },
    {
      label: 'All-Time Total',
      value: formatCurrency(allTimeTotal),
    },
    {
      label: 'Expenses Logged',
      value: String(expenseCount),
    },
    {
      label: unitLabel,
      value: costPerMile !== null ? formatCurrency(costPerMile) : '\u2014',
      action:
        costPerMile === null
          ? () =>
              router.push({
                pathname: '/(tabs)/(garage)/edit-bike',
                params: { id: motorcycleId },
              })
          : undefined,
      actionLabel: costPerMile === null ? 'Update mileage' : undefined,
    },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      {cards.map((card, index) => (
        <Animated.View
          key={card.label}
          entering={FadeInUp.delay(index * 50).duration(300)}
          style={{
            width: '48.5%',
            flexGrow: 1,
            flexBasis: '46%',
          }}
        >
          <View
            style={{
              backgroundColor: palette.neutral800,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 14,
              minHeight: 88,
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'PlusJakartaSans-Medium',
                fontSize: 12,
                color: palette.neutral400,
                marginBottom: 6,
              }}
            >
              {card.label}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans-Bold',
                  fontSize: 20,
                  fontWeight: '700',
                  color: palette.white,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {card.value}
              </Text>

              {card.badge && (
                <View
                  style={{
                    backgroundColor: card.badge.positive
                      ? palette.successBgDark
                      : palette.dangerBgDark,
                    borderRadius: 6,
                    borderCurve: 'continuous',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'PlusJakartaSans-SemiBold',
                      fontSize: 10,
                      fontWeight: '600',
                      color: card.badge.positive ? palette.success500 : palette.danger500,
                    }}
                  >
                    {card.badge.text}
                  </Text>
                </View>
              )}
            </View>

            {card.action && card.actionLabel && (
              <Pressable onPress={card.action} style={{ marginTop: 4 }}>
                <Text
                  style={{
                    fontFamily: 'PlusJakartaSans-SemiBold',
                    fontSize: 11,
                    fontWeight: '600',
                    color: palette.primary400,
                  }}
                >
                  {card.actionLabel}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      ))}
    </View>
  );
});
