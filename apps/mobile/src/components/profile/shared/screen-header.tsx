import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
}

export function ScreenHeader({ title, onBack, rightSlot }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const handleBack = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: isDark ? palette.dividerSubtleDark : palette.dividerLight,
      }}
    >
      <Pressable
        onPress={handleBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.iconBubbleDark : palette.neutral100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft
          size={18}
          color={isDark ? palette.neutral300 : palette.neutral600}
          strokeWidth={2}
        />
      </Pressable>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flex: 1,
          fontSize: 17,
          fontWeight: '600',
          color: isDark ? palette.neutral50 : palette.neutral950,
          textAlign: 'center',
          marginHorizontal: 12,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {rightSlot}
      </View>
    </View>
  );
}
