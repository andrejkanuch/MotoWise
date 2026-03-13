import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
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
      style={({ pressed }) => ({
        backgroundColor: disabled ? ONBOARDING_COLORS.textDimmed : ONBOARDING_COLORS.textPrimary,
        borderRadius: 20,
        borderCurve: 'continuous',
        paddingVertical: 18,
        paddingHorizontal: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        opacity: pressed && !disabled ? 0.9 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Text
        style={{
          fontSize: 17,
          fontWeight: '700',
          color: disabled ? ONBOARDING_COLORS.textMuted : ONBOARDING_COLORS.background,
        }}
      >
        {label}
      </Text>
      {showIcon ? (
        <View>
          <ChevronRight
            size={20}
            color={disabled ? ONBOARDING_COLORS.textMuted : ONBOARDING_COLORS.background}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
