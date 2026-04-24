import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLatestRelease, getWhatsNewRelease } from '../../data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useWhatsNewStore } from '../../stores/whats-new.store';
import { tint, useEditorialTheme } from '../../theme/editorial';

export default function WhatsNewModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  const setLastSeenVersion = useWhatsNewStore((s) => s.setLastSeenVersion);

  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const release = getWhatsNewRelease(currentVersion) ?? getLatestRelease();
  const displayVersion = release.version;
  const slides = release.slides;

  const dismiss = useCallback(() => {
    setLastSeenVersion(currentVersion);
    trackEvent(AnalyticsEvent.WHATS_NEW_DISMISSED, {
      version: currentVersion,
      completed_all: true,
    });
    router.back();
  }, [currentVersion, setLastSeenVersion, router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
          paddingBottom: 4,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: theme.ink,
              letterSpacing: -0.5,
            }}
          >
            {t('whatsNew.badge')}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: theme.ink3 }}>
            Version {displayVersion}
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            borderCurve: 'continuous',
            backgroundColor: theme.surface,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            opacity: pressed ? 0.5 : 1,
            marginTop: 4,
          })}
        >
          <X size={15} color={theme.ink3} />
        </Pressable>
      </Animated.View>

      {/* Feature cards */}
      <View
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20 }}
      >
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <Animated.View
              key={slide.titleKey}
              entering={FadeInUp.delay(100 + index * 70).duration(250)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: theme.line,
                padding: 16,
                marginBottom: index < slides.length - 1 ? 10 : 0,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: tint(slide.iconColor, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={24} color={slide.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.ink,
                    marginBottom: 3,
                  }}
                >
                  {t(slide.titleKey)}
                </Text>
                <Text style={{ fontSize: 13, color: theme.ink3, lineHeight: 18 }}>
                  {t(slide.descriptionKey)}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* CTA */}
      <Animated.View
        entering={FadeIn.delay(400).duration(250)}
        style={{
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 20) + 8,
        }}
      >
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            dismiss();
          }}
          style={({ pressed }) => ({
            backgroundColor: theme.warm,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.ink }}>
            {t('whatsNew.getStarted')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
