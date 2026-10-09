import * as Haptics from 'expo-haptics';
import { type Href, useRouter } from 'expo-router';
import {
  Bike,
  Check,
  ChevronRight,
  Compass,
  LayoutDashboard,
  MapPin,
  ScanLine,
  Wallet,
} from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, ZoomIn } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { GARAGE_ROUTE, HOME_ROUTE, TAB_ROUTE } from '../../config/routes';
import { deriveCompletedItems } from '../../lib/checklist-signals';
import {
  ALL_CHECKLIST_ITEMS,
  CHECKLIST_COMPLETION_TRIGGER,
  CHECKLIST_ITEM_ID,
  useChecklistStore,
} from '../../stores/checklist.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { GUTTER, radius, space, type } from '../../theme/type';
import { useChecklistSignals } from './use-checklist-signals';

const ICON_MAP: Record<string, typeof MapPin> = {
  MapPin,
  Compass,
  Wallet,
  Bike,
  LayoutDashboard,
  ScanLine,
};

const ROW_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;
const CHECK_SIZE = 24;
const PROGRESS_HEIGHT = 4;

export function OnboardingChecklist() {
  const { t } = useTranslation();
  const router = useRouter();
  const { t: theme } = useEditorialTheme();
  const { items, completedItems, dismissed, initialized, completeItem, dismiss } =
    useChecklistStore(
      useShallow((s) => ({
        items: s.items,
        completedItems: s.completedItems,
        dismissed: s.dismissed,
        initialized: s.initialized,
        completeItem: s.completeItem,
        dismiss: s.dismiss,
      })),
    );

  const active = initialized && !dismissed && items.length > 0;
  const openItemIds = useMemo(
    () => items.filter((item) => !completedItems.includes(item.id)).map((item) => item.id),
    [items, completedItems],
  );
  // The rider's own data ticks the items it proves (a bike photo, a finished
  // ride, an expense, a receipt scan) — see `lib/checklist-signals.ts`. The
  // bikes also route the "log first expense" item, whose form needs a bike.
  const { signals, bikes, settled } = useChecklistSignals(openItemIds, active);
  const dataCompleted = useMemo(
    () => deriveCompletedItems(openItemIds, signals),
    [openItemIds, signals],
  );
  // Persist them (and report each once: completeItem is idempotent). The render
  // below already counts them, so the card never shows them unticked first.
  useEffect(() => {
    for (const id of dataCompleted) completeItem(id, CHECKLIST_COMPLETION_TRIGGER.DATA);
  }, [dataCompleted, completeItem]);
  const firstBikeId = bikes?.[0]?.id;

  if (!active || !settled) return null;

  const doneIds = new Set([...completedItems, ...dataCompleted]);
  const completedCount = items.filter((item) => doneIds.has(item.id)).length;
  const totalCount = items.length;
  const allDone = completedCount >= totalCount;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (allDone) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutDown.duration(200)}
      style={{
        marginHorizontal: GUTTER,
        marginBottom: space.md,
        backgroundColor: theme.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        paddingHorizontal: space.md,
        paddingTop: space.md,
        paddingBottom: space.xs,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.sm,
          marginBottom: space.sm,
        }}
      >
        <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink, flex: 1 }]}>
          {t('checklist.getStarted')}
        </Text>
        <Text style={[type.caption, { color: theme.ink3, fontVariant: ['tabular-nums'] }]}>
          {t('checklist.progressLabel', { completed: completedCount, total: totalCount })}
        </Text>
      </View>

      {/* Progress bar */}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: totalCount, now: completedCount }}
        style={{
          height: PROGRESS_HEIGHT,
          backgroundColor: theme.surface2,
          borderRadius: PROGRESS_HEIGHT,
          overflow: 'hidden',
          marginBottom: space.xxs,
        }}
      >
        <View
          style={{
            height: PROGRESS_HEIGHT,
            width: `${progressPercent}%`,
            backgroundColor: theme.ink2,
          }}
        />
      </View>

      {/* Items */}
      <View>
        {items.map((item) => {
          const isCompleted = doneIds.has(item.id);
          const IconComponent = ICON_MAP[item.icon] ?? MapPin;

          return (
            <Pressable
              key={item.id}
              onPress={() => {
                if (!isCompleted) {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                  completeItem(item.id);
                }
                if (item.id === CHECKLIST_ITEM_ID.FIRST_EXPENSE) {
                  // Expense screens require a motorcycleId — route to the dashboard
                  // for the user's bike (its empty state + quick-add lead to the
                  // form). If bikes are confirmed-empty, send them to add one; if the
                  // bikes query hasn't resolved yet, fall back to the garage tab
                  // (never wrongly imply "no bikes" mid-load).
                  if (firstBikeId) {
                    router.push({
                      pathname: GARAGE_ROUTE.EXPENSE_DASHBOARD,
                      params: { motorcycleId: firstBikeId },
                    });
                  } else if (bikes) {
                    router.push(HOME_ROUTE.ADD_BIKE as Href);
                  } else {
                    router.push(TAB_ROUTE.GARAGE as Href);
                  }
                  return;
                }
                const knownItem = ALL_CHECKLIST_ITEMS.find((ci) => ci.id === item.id);
                if (knownItem) router.push(knownItem.deepLink as Href);
              }}
              accessibilityRole="button"
              accessibilityState={{ checked: isCompleted }}
              android_ripple={{ color: tint(theme.ink, 0.08) }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                minHeight: ROW_MIN_HEIGHT,
                paddingVertical: space.xs,
                opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
              })}
            >
              {/* Checkbox */}
              <View
                style={{
                  width: CHECK_SIZE,
                  height: CHECK_SIZE,
                  borderRadius: CHECK_SIZE / 2,
                  borderWidth: isCompleted ? 0 : 1.5,
                  borderColor: theme.ink4,
                  backgroundColor: isCompleted ? theme.warm : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCompleted && (
                  <Animated.View entering={ZoomIn.duration(200)}>
                    <Check size={14} color={theme.onWarm} strokeWidth={3} />
                  </Animated.View>
                )}
              </View>

              {/* Icon */}
              <IconComponent
                size={18}
                color={isCompleted ? theme.ink4 : theme.ink2}
                strokeWidth={1.8}
              />

              {/* Label */}
              <Text
                style={[
                  type.body,
                  {
                    flex: 1,
                    color: isCompleted ? theme.ink4 : theme.ink,
                    textDecorationLine: isCompleted ? 'line-through' : 'none',
                  },
                ]}
              >
                {t(item.labelKey as never)}
              </Text>

              {/* Chevron */}
              {!isCompleted && <ChevronRight size={17} color={theme.ink4} strokeWidth={2} />}
            </Pressable>
          );
        })}
      </View>

      {/* Dismiss */}
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        style={{
          alignSelf: 'flex-end',
          minHeight: ROW_MIN_HEIGHT,
          justifyContent: 'center',
          paddingHorizontal: space.xs,
        }}
      >
        <Text style={[type.label, { color: theme.ink3 }]}>{t('checklist.dismiss')}</Text>
      </Pressable>
    </Animated.View>
  );
}
