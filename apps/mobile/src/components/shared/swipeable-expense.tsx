import { type Href, router } from 'expo-router';
import { ChevronRight, Trash2, Wrench } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, type TextStyle, View } from 'react-native';
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
import { CATEGORY_LABELS, formatExpenseDate, getExpenseTitle } from '../../lib/expense-constants';
import { confirmDeleteExpenseAlert } from '../../lib/expense-delete';
import { SYSTEM_WEIGHT, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { type HubTheme, hubCategoryColor, useHubTheme } from '../bike-hub/ui/tokens';

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
  onDelete: (id: string) => void;
  index: number;
  /** True only when maintenanceTaskId resolves to a live task (matches detail). */
  hasServiceRecord?: boolean;
  /** Dark rows sit flush in one hub card: a hairline under every row but the last. */
  divider?: boolean;
  /**
   * False while the row cannot be seen or touched (a hidden hub segment, a
   * sheet or screen over the hub). Switches the swipe / long-press / tap
   * recognisers off natively and refuses navigation: on iOS Fabric a hidden
   * row's recogniser can outlive its view on a recycled UIView elsewhere on
   * screen (see `useSegmentInteractive`).
   */
  enabled?: boolean;
}

/**
 * The bike hub's row: flush in one hub card, hairline dividers, condensed
 * figures and hub category colours — in the active scheme's hub colours.
 */
function rowLook(hub: HubTheme) {
  return {
    title: { ...SYSTEM_WEIGHT.semibold, fontSize: 15, lineHeight: 18, color: hub.text },
    meta: { ...type.caption, color: hub.muted },
    amount: { ...type.figureSmall, color: hub.text },
  } satisfies Record<string, TextStyle>;
}

export function SwipeableExpense({
  expense,
  motorcycleId,
  onDelete,
  index,
  hasServiceRecord = false,
  divider = false,
  enabled = true,
}: SwipeableExpenseProps) {
  const hub = useHubTheme();
  const look = rowLook(hub);
  const { t } = useTranslation();
  const { formatFor } = useCurrency();
  const amountText = formatFor(expense.amount, expense.currency);
  const title = getExpenseTitle(
    expense,
    t(`expenses.category_${expense.category}`, {
      defaultValue: CATEGORY_LABELS[expense.category] ?? expense.category,
    }),
  );
  const translateX = useSharedValue(0);
  const deleteThreshold = -80;

  // Tapping the row opens expense-detail, which hydrates from the expenses cache
  // by id — only pass ids (no spoofable amount/title params).
  // Read at call time: a gesture's JS callback can land after the row was
  // hidden, before the native `enabled` update reached the recogniser.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const openDetail = useCallback(() => {
    if (!enabledRef.current) return;
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
    if (!enabledRef.current) {
      translateX.value = withSpring(0);
      return;
    }
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
    .enabled(enabled)
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
    .enabled(enabled)
    .minDuration(500)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(confirmDelete)();
      }
    });

  const tapGesture = Gesture.Tap()
    .enabled(enabled)
    .withTestId(`expense-row-tap-${expense.id}`)
    .onEnd((_event, success) => {
      if (success) runOnJS(openDetail)();
    });

  const composedGesture = Gesture.Race(panGesture, longPressGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, -20, 0], [1, 1, 0], 'clamp'),
  }));

  const catColor = hubCategoryColor(expense.category, hub);

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
              backgroundColor: hub.late,
              borderRadius: 0,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
            },
            deleteButtonStyle,
          ]}
        >
          <Trash2 size={18} color={hub.ink} strokeWidth={2} />
        </Animated.View>

        {/* Expense row */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${amountText}, ${formatExpenseDate(expense.date)}`}
            // Swipe and long-press have no screen-reader equivalent; these do.
            accessibilityActions={[
              { name: 'activate' },
              { name: 'delete', label: t('common.delete') },
            ]}
            onAccessibilityAction={(event) =>
              event.nativeEvent.actionName === 'delete' ? confirmDelete() : openDetail()
            }
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingLeft: 14,
                paddingRight: 12,
                backgroundColor: hub.card,
                borderRadius: 0,
                borderCurve: 'continuous',
                borderBottomWidth: divider ? 1 : 0,
                borderBottomColor: hub.hairline,
                gap: 12,
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
                <Text style={[{ flexShrink: 1 }, look.title]} numberOfLines={2}>
                  {title}
                </Text>
                {hasServiceRecord && (
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      borderCurve: 'continuous',
                      backgroundColor: hub.raised,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel={t('expenses.hasServiceRecord', {
                      defaultValue: 'Has service record',
                    })}
                  >
                    <Wrench size={11} color={hub.dim} strokeWidth={2} />
                  </View>
                )}
              </View>
              <Text style={[{ marginTop: 3 }, look.meta]}>{formatExpenseDate(expense.date)}</Text>
            </View>
            <Text style={look.amount}>{amountText}</Text>
            <ChevronRight size={16} color={hub.muted} strokeWidth={2} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
