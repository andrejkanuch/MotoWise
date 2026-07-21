import { palette } from '@motovault/design-system';
import { type Href, router } from 'expo-router';
import { ChevronRight, Trash2, Wrench } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatExpenseDate,
  getExpenseTitle,
} from '../../lib/expense-constants';
import { confirmDeleteExpenseAlert } from '../../lib/expense-delete';
import { triggerImpact } from '../../utils/haptics';

export interface SwipeableExpenseProps {
  expense: {
    id: string;
    amount: number;
    category: string;
    currency?: string | null;
    description?: string | null;
    itemName?: string | null;
    maintenanceTaskId?: string | null;
    date: string;
  };
  motorcycleId: string;
  isDark: boolean;
  onDelete: (id: string) => void;
  index: number;
  /** True only when maintenanceTaskId resolves to a live task (matches detail). */
  hasServiceRecord?: boolean;
}

export function SwipeableExpense({
  expense,
  motorcycleId,
  isDark,
  onDelete,
  index,
  hasServiceRecord = false,
}: SwipeableExpenseProps) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const translateX = useSharedValue(0);
  const deleteThreshold = -80;

  // Tapping the row opens expense-detail, which hydrates from the expenses cache
  // by id — only pass ids (no spoofable amount/title params).
  const openDetail = useCallback(() => {
    triggerImpact();
    const href: Href = {
      pathname: '/(tabs)/(garage)/expense-detail',
      params: {
        expenseId: expense.id,
        motorcycleId,
      },
    };
    router.push(href);
  }, [expense.id, motorcycleId]);

  const confirmDelete = useCallback(() => {
    confirmDeleteExpenseAlert(t, {
      onCancel: () => {
        translateX.value = withSpring(0);
      },
      onConfirm: () => {
        translateX.value = withTiming(0);
        onDelete(expense.id);
      },
    });
  }, [expense.id, onDelete, t, translateX]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -100);
      }
    })
    .onEnd(() => {
      if (translateX.value < deleteThreshold) {
        runOnJS(confirmDelete)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(confirmDelete)();
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(openDetail)();
  });

  const composedGesture = Gesture.Race(panGesture, longPressGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, -20, 0], [1, 1, 0], 'clamp'),
  }));

  const catColor = CATEGORY_COLORS[expense.category] ?? palette.neutral500;

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 5) * 50).duration(250)}>
      <View style={{ position: 'relative' }}>
        {/* Delete background */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 80,
              backgroundColor: palette.danger500,
              borderRadius: 10,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
            },
            deleteButtonStyle,
          ]}
        >
          <Trash2 size={18} color={palette.white} strokeWidth={2} />
        </Animated.View>

        {/* Expense row */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                backgroundColor: isDark ? palette.neutral800 : palette.white,
                borderRadius: 10,
                borderCurve: 'continuous',
                gap: 10,
              },
              animatedStyle,
            ]}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                borderCurve: 'continuous',
                backgroundColor: catColor,
              }}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={{
                    flexShrink: 1,
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? palette.neutral50 : palette.neutral950,
                  }}
                  numberOfLines={1}
                >
                  {getExpenseTitle(
                    expense,
                    t(`expenses.category_${expense.category}`, {
                      defaultValue: CATEGORY_LABELS[expense.category] ?? expense.category,
                    }),
                  )}
                </Text>
                {hasServiceRecord && (
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      borderCurve: 'continuous',
                      backgroundColor: isDark ? palette.neutral700 : palette.neutral100,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel={t('expenses.hasServiceRecord', {
                      defaultValue: 'Has service record',
                    })}
                  >
                    <Wrench size={11} color={palette.neutral500} strokeWidth={2} />
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>
                {formatExpenseDate(expense.date)}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {formatCurrency(expense.amount)}
            </Text>
            <ChevronRight size={16} color={palette.neutral400} strokeWidth={2} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
