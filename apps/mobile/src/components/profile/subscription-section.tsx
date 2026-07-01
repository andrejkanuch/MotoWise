import { palette } from '@motovault/design-system';
import { ChevronRight, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { presentPaywall } from '../../lib/subscription';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

export function SubscriptionSection({ isPro, isDark }: { isPro: boolean; isDark: boolean }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  if (isPro) {
    return (
      <Animated.View entering={FadeInUp.delay(240).duration(400)}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: `${theme.purple}25`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Crown size={22} color={theme.purple} strokeWidth={2} fill={theme.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.ink,
                fontSize: 17,
                fontWeight: '700',
              }}
            >
              {t('profile.proActive', { defaultValue: 'Pro Active' })}
            </Text>
            <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
              {t('profile.proActiveDesc', {
                defaultValue: 'All premium features unlocked',
              })}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(400)}>
      <Pressable
        onPress={() => {
          triggerImpact();
          presentPaywall({
            source: 'profile',
            feature: 'subscription',
            surface: 'profile_pro_banner',
          });
        }}
        style={{ borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}
      >
        <View
          style={{
            backgroundColor: theme.warm,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: tint(palette.white, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Crown size={22} color={palette.warning500} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.white, fontSize: 17, fontWeight: '700' }}>
              {t('profile.proBanner')}
            </Text>
            <Text style={{ color: tint(palette.white, 0.7), fontSize: 13, marginTop: 2 }}>
              {t('profile.proDescription')}
            </Text>
          </View>
          <ChevronRight size={20} color={tint(palette.white, 0.6)} strokeWidth={2} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
