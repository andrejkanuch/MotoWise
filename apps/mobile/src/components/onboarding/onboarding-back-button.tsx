import { ChevronLeft } from 'lucide-react-native';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { ONBOARDING_COLORS } from './onboarding-colors';

interface OnboardingBackButtonProps {
  onPress: () => void;
  /** Positioning/override styles merged over the base circular button. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Shared onboarding back control — a 36px circular button with the lucide
 * `ChevronLeft` SVG (not a text glyph, which mis-centers / overflows the
 * circle). One component so every step's Back affordance is identical; the
 * parent positions it via `style`.
 */
export function OnboardingBackButton({
  onPress,
  style,
  accessibilityLabel = 'Go back',
}: OnboardingBackButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: 36,
          height: 36,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
    </Pressable>
  );
}
