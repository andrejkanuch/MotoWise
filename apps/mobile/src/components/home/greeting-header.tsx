import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface GreetingHeaderProps {
  greetingText: string;
  subtitleText: string;
  avatarInitial: string;
  isDark: boolean;
  onAvatarPress: () => void;
}

export function GreetingHeader({
  greetingText,
  subtitleText,
  avatarInitial,
  isDark,
  onAvatarPress,
}: GreetingHeaderProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
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
            fontSize: 26,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {greetingText}
        </Text>
        <Text
          style={{
            fontSize: 14,
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
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: palette.primary500,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: isDark ? palette.primary800 : palette.primary200,
          }}
        >
          <Text style={{ color: palette.white, fontSize: 16, fontWeight: '700' }}>
            {avatarInitial}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
