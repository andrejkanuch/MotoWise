import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { radius, space, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';

const MIN_TOUCH_TARGET = process.env.EXPO_OS === 'android' ? 48 : 44;
const BOX_SIZE = 22;

/**
 * The "developer may contact me" checkbox: a full-width row so the whole line
 * is the touch target, announced as a checkbox with its checked state.
 */
export function ContactCheckbox({
  label,
  checked,
  onChange,
  compact = false,
  testID,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Smaller caption text (the onboarding line). */
  compact?: boolean;
  testID?: string;
}) {
  const { t } = useEditorialTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerSelection();
        onChange(!checked);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      android_ripple={{ color: tint(t.ink, 0.08) }}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: compact ? 0 : space.md,
        paddingVertical: space.xs,
        opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          borderRadius: radius.chip / 2,
          borderCurve: 'continuous',
          borderWidth: 1.5,
          borderColor: checked ? t.warm : t.ink4,
          backgroundColor: checked ? t.warm : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Check size={15} color={t.onWarm} strokeWidth={3} /> : null}
      </View>
      <Text
        style={[compact ? type.caption : type.body, { flex: 1, color: compact ? t.ink2 : t.ink }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
