import { palette } from '@motovault/design-system';
import { Trash2 } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCurrency } from '../../hooks/use-currency';
import { CATEGORY_COLORS, CATEGORY_LABELS, formatExpenseDate } from '../../lib/expense-constants';

export interface SwipeableExpenseProps {
  expense: {
    id: string;
    amount: number;
    category: string;
    description?: string | null;
    date: string;
  };
  isDark: boolean;
  onDelete: (id: string) => void;
  index: number;
}

export function SwipeableExpense({ expense, isDark, onDelete, index }: SwipeableExpenseProps) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const translateX = useSharedValue(0);
  const deleteThreshold = -80;

  const confirmDelete = useCallback(() => {
    Alert.alert(
      t('expenses.deleteTitle', { defaultValue: 'Delete Expense' }),
      t('expenses.deleteMessage', {
        defaultValue: 'Are you sure you want to delete this expense?',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
          onPress: () => {
            translateX.value = withSpring(0);
          },
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => {
            translateX.value = withTiming(0);
            onDelete(expense.id);
          },
        },
      ],
    );
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity:
      translateX.value < -20 ? withTiming(1, { duration: 150 }) : withTiming(0, { duration: 150 }),
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
        <GestureDetector gesture={panGesture}>
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
                backgroundColor: catColor,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                }}
                numberOfLines={1}
              >
                {expense.description || CATEGORY_LABELS[expense.category] || expense.category}
              </Text>
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
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
