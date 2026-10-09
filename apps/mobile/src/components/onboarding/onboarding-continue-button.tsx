import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { radius, space, type } from '../../theme/type';
import { triggerNotification } from '../../utils/haptics';
import { useOnboardingColors } from './onboarding-colors';

interface OnboardingContinueButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  showIcon?: boolean;
}

export function OnboardingContinueButton({
  label,
  onPress,
  disabled = false,
  showIcon = true,
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
      accessibilityRole="button"
      accessibilityState={{ disabled }}
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
        opacity: pressed && !disabled ? 0.9 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Text style={[type.bodyStrong, { color: disabled ? oc.textMuted : oc.textOnAccent }]}>
        {label}
      </Text>
      {showIcon ? <ArrowRight size={18} color={disabled ? oc.textMuted : oc.textOnAccent} /> : null}
    </Pressable>
  );
}
