import { ChevronLeft } from 'lucide-react-native';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useOnboardingColors } from './onboarding-colors';

interface OnboardingBackButtonProps {
  onPress: () => void;
  /** Positioning/override styles merged over the base circular button. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Shared onboarding back control — a 44pt circular button with the lucide
 * `ChevronLeft` SVG (not a text glyph, which mis-centers / overflows the
 * circle). One component so every step's Back affordance is identical; the
 * parent positions it via `style`.
 */
export function OnboardingBackButton({
  onPress,
  style,
  accessibilityLabel = 'Go back',
}: OnboardingBackButtonProps) {
  const oc = useOnboardingColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: oc.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <ChevronLeft size={20} color={oc.textPrimary} />
    </Pressable>
  );
}
