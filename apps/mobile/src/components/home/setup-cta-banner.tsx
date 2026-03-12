import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { ArrowRight, CircuitBoard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';

interface SetupCtaBannerProps {
  isDark: boolean;
  onPress: () => void;
}

export function SetupCtaBanner({ isDark, onPress }: SetupCtaBannerProps) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(300)}>
      <CardWrapper tier="subtle" style={{ overflow: 'hidden' }}>
        {/* Left accent strip */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: palette.primary500,
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 20,
          }}
        />
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios')
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            paddingLeft: 16,
          }}
        >
          <CircuitBoard size={18} color={palette.primary500} strokeWidth={1.8} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {t('home.setupProfile')}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: isDark ? palette.neutral50 : palette.neutral950,
                opacity: 0.5,
                marginTop: 1,
              }}
            >
              {t('home.setupProfileDesc')}
            </Text>
          </View>
          <ArrowRight size={16} color={palette.primary500} strokeWidth={2} />
        </Pressable>
      </CardWrapper>
    </Animated.View>
  );
}
