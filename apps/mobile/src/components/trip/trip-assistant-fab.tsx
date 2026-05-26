import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface TripAssistantFABProps {
  onPress: () => void;
  /** Extra bottom offset so it sits above other floating UI (e.g. sticky CTAs). */
  bottomOffset?: number;
}

export function TripAssistantFAB({ onPress, bottomOffset = 24 }: TripAssistantFABProps) {
  return (
    <Animated.View
      entering={FadeIn.delay(120).duration(200)}
      style={{
        position: 'absolute',
        right: 16,
        bottom: bottomOffset,
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel="Ask trip assistant"
        accessibilityHint="Opens an AI chat scoped to this trip"
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: palette.accent500,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: palette.neutral950,
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <View>
          <Sparkles size={22} color={palette.white} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
