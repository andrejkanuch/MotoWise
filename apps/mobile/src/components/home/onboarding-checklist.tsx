import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { type Href, useRouter } from 'expo-router';
import {
  Bike,
  Check,
  ChevronRight,
  Compass,
  LayoutDashboard,
  MapPin,
  Wallet,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, ZoomIn } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { ALL_CHECKLIST_ITEMS, useChecklistStore } from '../../stores/checklist.store';
import { useEditorialTheme } from '../../theme/editorial';

const ICON_MAP: Record<string, typeof MapPin> = {
  MapPin,
  Compass,
  Wallet,
  Bike,
  LayoutDashboard,
};

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

  if (!initialized || dismissed || items.length === 0) return null;

  const completedCount = completedItems.length;
  const totalCount = items.length;
  const allDone = completedCount >= totalCount;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (allDone) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify().damping(18)}
      exiting={FadeOutDown.duration(300)}
      style={{
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: theme.line,
        padding: 20,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontFamily: 'InstrumentSerif',
            fontSize: 20,
            color: theme.ink,
          }}
        >
          {t('checklist.getStarted')}
        </Text>
        <Text style={{ fontSize: 13, color: theme.ink4 }}>
          {t('checklist.progressLabel', { completed: completedCount, total: totalCount })}
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 3,
          backgroundColor: theme.surface2,
          borderRadius: 2,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            height: 3,
            width: `${progressPercent}%`,
            backgroundColor: theme.warm,
            borderRadius: 2,
          }}
        />
      </View>

      {/* Items */}
      <View style={{ gap: 12 }}>
        {items.map((item) => {
          const isCompleted = completedItems.includes(item.id);
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
                const knownItem = ALL_CHECKLIST_ITEMS.find((ci) => ci.id === item.id);
                if (knownItem) router.push(knownItem.deepLink as Href);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {/* Checkbox */}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: isCompleted ? 0 : 1,
                  borderColor: theme.line,
                  backgroundColor: isCompleted ? theme.warm : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCompleted && (
                  <Animated.View entering={ZoomIn.duration(200).springify()}>
                    <Check size={14} color={palette.editorialDarkBg} strokeWidth={3} />
                  </Animated.View>
                )}
              </View>

              {/* Icon */}
              <IconComponent
                size={18}
                color={isCompleted ? theme.ink4 : theme.warm}
                strokeWidth={1.8}
              />

              {/* Label */}
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: isCompleted ? theme.ink4 : theme.ink,
                  textDecorationLine: isCompleted ? 'line-through' : 'none',
                }}
              >
                {t(item.labelKey as never)}
              </Text>

              {/* Chevron */}
              {!isCompleted && <ChevronRight size={12} color={theme.ink4} strokeWidth={1.5} />}
            </Pressable>
          );
        })}
      </View>

      {/* Dismiss */}
      <Pressable onPress={dismiss} style={{ alignSelf: 'flex-end', marginTop: 16 }} hitSlop={12}>
        <Text style={{ fontSize: 13, color: theme.ink4 }}>{t('checklist.dismiss')}</Text>
      </Pressable>
    </Animated.View>
  );
}
