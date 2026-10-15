import { FEEDBACK_QUICK_PICK, type FeedbackQuickPick } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';

const MIN_TOUCH_TARGET = process.env.EXPO_OS === 'android' ? 48 : 44;

const QUICK_PICKS = [
  { value: FEEDBACK_QUICK_PICK.LOVE, labelKey: 'feedback.quickPickLove' },
  { value: FEEDBACK_QUICK_PICK.WISH, labelKey: 'feedback.quickPickWish' },
  { value: FEEDBACK_QUICK_PICK.BROKEN, labelKey: 'feedback.quickPickBroken' },
] as const;

/** Optional single-select topic above the message; tapping the selected chip clears it. */
export function QuickPickChips({
  value,
  onChange,
}: {
  value: FeedbackQuickPick | null;
  onChange: (value: FeedbackQuickPick | null) => void;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('feedback.quickPickLabel')}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
    >
      {QUICK_PICKS.map((pick) => {
        const selected = value === pick.value;
        return (
          <Pressable
            key={pick.value}
            testID={`feedback-quick-pick-${pick.value}`}
            onPress={() => {
              triggerSelection();
              onChange(selected ? null : pick.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            android_ripple={{ color: theme.line2 }}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH_TARGET,
              justifyContent: 'center',
              paddingHorizontal: space.md,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              backgroundColor: theme.surface,
              borderWidth: 1.5,
              borderColor: selected ? theme.warm : theme.surface2,
              overflow: 'hidden',
              opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
            })}
          >
            <Text
              style={[
                type.label,
                selected ? SYSTEM_WEIGHT.semibold : null,
                { color: selected ? theme.warm2 : theme.ink2 },
              ]}
            >
              {t(pick.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
