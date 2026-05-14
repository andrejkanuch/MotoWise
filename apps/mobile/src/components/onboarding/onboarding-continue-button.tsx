import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { triggerNotification } from '../../utils/haptics';
import { ONBOARDING_COLORS } from './onboarding-colors';

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
        backgroundColor: disabled ? ONBOARDING_COLORS.textDimmed : ONBOARDING_COLORS.warm,
        borderRadius: 16,
        borderCurve: 'continuous',
        paddingVertical: 18,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        opacity: pressed && !disabled ? 0.9 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: disabled ? ONBOARDING_COLORS.textMuted : ONBOARDING_COLORS.textOnAccent,
          letterSpacing: -0.15,
        }}
      >
        {label}
      </Text>
      {showIcon ? (
        <ArrowRight
          size={18}
          color={disabled ? ONBOARDING_COLORS.textMuted : ONBOARDING_COLORS.textOnAccent}
        />
      ) : null}
    </Pressable>
  );
}
