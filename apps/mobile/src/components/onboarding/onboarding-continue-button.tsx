import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { tint } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerNotification } from '../../utils/haptics';
import { useOnboardingColors } from './onboarding-colors';

interface OnboardingContinueButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Trailing arrow. Off by default — the copper fill already says "go". */
  showIcon?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/** Largest Dynamic Type multiplier for footer button labels. */
export const FOOTER_MAX_FONT_SCALE = 1.4;

/** The copper 52pt primary action of every onboarding step (ink = `t.onWarm`). */

export function OnboardingContinueButton({
  label,
  onPress,
  disabled = false,
  showIcon = false,
  testID,
  accessibilityLabel,
}: OnboardingContinueButtonProps) {
  const oc = useOnboardingColors();
  const handlePress = () => {
    triggerNotification(Haptics.NotificationFeedbackType.Success);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      android_ripple={{ color: tint(oc.textOnAccent, 0.18), foreground: true }}
      style={({ pressed }) => ({
        backgroundColor: disabled ? oc.surface2 : oc.warm,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        minHeight: 52,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        width: '100%',
        overflow: 'hidden',
        opacity: pressed && !disabled && process.env.EXPO_OS === 'ios' ? 0.88 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Text
        // Sticky footers sit above the keyboard: cap growth so AX sizes keep
        // the focused field in view on small phones.
        maxFontSizeMultiplier={FOOTER_MAX_FONT_SCALE}
        style={[type.bodyStrong, { color: disabled ? oc.textMuted : oc.textOnAccent }]}
      >
        {label}
      </Text>
      {showIcon ? <ArrowRight size={18} color={disabled ? oc.textMuted : oc.textOnAccent} /> : null}
    </Pressable>
  );
}
