import { palette } from '@motovault/design-system';
import { Compass, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface EmptyFeedStateProps {
  followsAnyone: boolean;
  onFindRiders?: () => void;
}

export function EmptyFeedState({ followsAnyone, onFindRiders }: EmptyFeedStateProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const iconColor = isDark ? palette.neutral500 : palette.neutral400;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const ctaBg = isDark ? palette.primary500 : palette.primary950;

  if (followsAnyone) {
    return (
      <Animated.View
        entering={FadeInUp.delay(100).duration(300)}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
          paddingVertical: 60,
        }}
      >
        <Compass size={48} color={iconColor} strokeWidth={1.5} />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: titleColor,
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          {t('feed.emptyFollowingTitle')}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: subtitleColor,
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {t('feed.emptyFollowingSubtitle')}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(100).duration(300)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
      }}
    >
      <Users size={48} color={iconColor} strokeWidth={1.5} />
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: titleColor,
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        {t('feed.emptyNoFollowsTitle')}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: subtitleColor,
          marginTop: 8,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {t('feed.emptyNoFollowsSubtitle')}
      </Text>
      {onFindRiders && (
        <Pressable
          onPress={onFindRiders}
          style={{
            marginTop: 24,
            backgroundColor: ctaBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.white }}>
            {t('feed.findRiders')}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
