import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

interface GreetingHeaderProps {
  greetingText: string;
  subtitleText: string;
  avatarInitial: string;
  isDark: boolean;
  healthScore?: number;
  onAvatarPress: () => void;
}

function getAvatarBorderColor(healthScore: number | undefined, isDark: boolean): string {
  if (healthScore == null) return isDark ? palette.primary800 : palette.primary200;
  if (healthScore >= 75) return palette.success500;
  if (healthScore >= 40) return palette.warning500;
  return palette.danger500;
}

export function GreetingHeader({
  greetingText,
  subtitleText,
  avatarInitial,
  isDark,
  healthScore,
  onAvatarPress,
}: GreetingHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 4,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {greetingText}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            color: isDark ? palette.neutral400 : palette.neutral500,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {subtitleText}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onAvatarPress();
        }}
        accessibilityRole="button"
        accessibilityLabel="Profile"
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            borderCurve: 'continuous',
            backgroundColor: palette.primary500,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: getAvatarBorderColor(healthScore, isDark),
          }}
        >
          <Text style={{ color: palette.white, fontSize: 16, fontWeight: '700' }}>
            {avatarInitial}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
