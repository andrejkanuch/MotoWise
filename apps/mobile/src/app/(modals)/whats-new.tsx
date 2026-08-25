import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getLatestRelease,
  visibleSlides,
  type WhatsNewAction,
  type WhatsNewSlide,
} from '../../data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useWhatsNewStore } from '../../stores/whats-new.store';
import { tint, useEditorialTheme } from '../../theme/editorial';

export default function WhatsNewModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  const setLastSeenVersion = useWhatsNewStore((s) => s.setLastSeenVersion);

  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const release = getLatestRelease();
  const displayVersion = release.version;
  // MUST be the platform-filtered set, not `release.slides`. Slides carry a
  // `platforms` gate for features that are not cross-platform (CarPlay is
  // iOS-only; Android Auto is deliberately excluded from this app), and reading
  // the raw list showed Android users a CarPlay slide in 3.19.1.
  const slides = visibleSlides(release);

  // Cached from the home screen — used to resolve the fast-action target bike.
  const { data: bikesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const slide: WhatsNewSlide = slides[currentIndex];
  const Icon = slide.icon;
  const isLast = currentIndex === slides.length - 1;
  const featureTint = slide.iconColor;
  const featureTintSoft = tint(featureTint, 0.14);

  const dismiss = useCallback(() => {
    setLastSeenVersion(currentVersion);
    trackEvent(AnalyticsEvent.WHATS_NEW_DISMISSED, {
      version: currentVersion,
      completed_all: true,
    });
    router.back();
  }, [currentVersion, setLastSeenVersion, router]);

  // Fast-action CTA: mark the release seen, close the modal, and deep-link to the
  // feature. For the document vault that means the rider's primary bike (or the
  // first one) where the Documents section lives; with no bikes, the garage.
  const runAction = useCallback(
    (action: WhatsNewAction) => {
      setLastSeenVersion(currentVersion);
      const bikes = bikesData?.myMotorcycles ?? [];
      const target = bikes.find((b) => b.isPrimary) ?? bikes[0];
      trackEvent(AnalyticsEvent.WHATS_NEW_CTA_TAPPED, {
        version: currentVersion,
        action,
        had_bike: !!target,
      });
      router.back();
      if (action === 'open-document-vault') {
        const href: Href = target
          ? { pathname: '/(tabs)/(garage)/bike/[id]', params: { id: target.id } }
          : '/(tabs)/(garage)';
        setTimeout(() => router.push(href), 60);
      }
    },
    [bikesData, currentVersion, setLastSeenVersion, router],
  );

  const handleNext = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isLast) {
      if (slide.ctaAction) {
        runAction(slide.ctaAction);
      } else {
        dismiss();
      }
    } else {
      const nextIndex = currentIndex + 1;
      trackEvent(AnalyticsEvent.WHATS_NEW_SLIDE_VIEWED, {
        version: currentVersion,
        slide_index: nextIndex,
        slide_title: slides[nextIndex]?.titleKey ?? '',
        total_slides: slides.length,
      });
      setCurrentIndex(nextIndex);
    }
  }, [isLast, dismiss, runAction, slide.ctaAction, currentIndex, currentVersion, slides]);

  const handleSkip = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    trackEvent(AnalyticsEvent.WHATS_NEW_SKIPPED, {
      version: currentVersion,
      skipped_at_slide: currentIndex,
      total_slides: slides.length,
    });
    setCurrentIndex(slides.length - 1);
  }, [slides.length, currentVersion, currentIndex]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Radial tint glow at top — simulated with a gradient overlay */}
      <LinearGradient
        colors={[featureTintSoft, 'transparent']}
        locations={[0, 0.7]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 400,
        }}
      />

      {/* Top bar: version label + skip */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
        }}
      >
        <Text
          style={{
            fontFamily: 'GeistMono-SemiBold',
            fontSize: 11,
            color: theme.ink3,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {`${t('whatsNew.badge')} · v${displayVersion}`}
        </Text>
        {!isLast && (
          <Pressable onPress={handleSkip} hitSlop={16}>
            <Text style={{ color: theme.ink3, fontSize: 13, fontWeight: '500' }}>
              {t('common.skip')}
            </Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Hero visual card */}
      <Animated.View
        key={`hero-${currentIndex}`}
        entering={FadeIn.duration(320)}
        exiting={FadeOut.duration(200)}
        style={{
          marginTop: 32,
          marginHorizontal: 24,
          height: 280,
          borderRadius: 24,
          borderCurve: 'continuous',
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Decorative gradient blob */}
        <LinearGradient
          colors={['transparent', tint(featureTint, 0.25)]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />

        {/* Decorative curved lines (using View borders) */}
        <View
          style={{
            position: 'absolute',
            top: 60,
            left: -40,
            right: -40,
            height: 200,
            borderRadius: 200,
            borderWidth: 1,
            borderColor: tint(featureTint, 0.12),
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 80,
            left: -20,
            right: -20,
            height: 200,
            borderRadius: 200,
            borderWidth: 1,
            borderColor: tint(featureTint, 0.08),
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 40,
            left: -60,
            right: -60,
            height: 200,
            borderRadius: 200,
            borderWidth: 1,
            borderColor: tint(featureTint, 0.06),
          }}
        />

        {/* Icon badge */}
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            borderCurve: 'continuous',
            backgroundColor: featureTintSoft,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: featureTint,
            shadowOffset: { width: 0, height: 24 },
            shadowOpacity: 0.35,
            shadowRadius: 48,
          }}
        >
          <Icon size={52} color={featureTint} />
        </View>

        {/* Step counter */}
        <View
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            backgroundColor: tint(theme.bg, 0.55),
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 99,
          }}
        >
          <Text
            style={{
              fontFamily: 'GeistMono-SemiBold',
              fontSize: 11.5,
              color: theme.ink2,
              letterSpacing: 0.5,
            }}
          >
            {String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </Text>
        </View>
      </Animated.View>

      {/* Copy area */}
      <Animated.View
        key={`copy-${currentIndex}`}
        entering={FadeInUp.delay(60).duration(350)}
        exiting={FadeOutDown.duration(200)}
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 32,
        }}
      >
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 38,
            color: theme.ink,
            lineHeight: 40,
            letterSpacing: -0.7,
            marginBottom: 14,
          }}
        >
          {t(slide.titleKey as never)}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: theme.ink2,
            lineHeight: 22.5,
          }}
        >
          {t(slide.descriptionKey as never)}
        </Text>
      </Animated.View>

      {/* Dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 7,
          marginBottom: 18,
        }}
      >
        {slides.map((s, idx) => (
          <Pressable key={s.titleKey} onPress={() => setCurrentIndex(idx)} hitSlop={8}>
            <Animated.View
              style={{
                width: idx === currentIndex ? 22 : 7,
                height: 7,
                borderRadius: 99,
                backgroundColor: idx === currentIndex ? featureTint : tint(theme.ink, 0.16),
              }}
              layout={undefined}
            />
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 20) + 8,
        }}
      >
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => ({
            backgroundColor: featureTint,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingVertical: 17,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: featureTint,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.45,
            shadowRadius: 28,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
            {isLast
              ? slide.ctaAction
                ? t((slide.ctaLabelKey ?? 'whatsNew.getStarted') as never)
                : t('whatsNew.getStarted')
              : t('whatsNew.next')}
          </Text>
          <ArrowRight size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
