import { palette } from '@motovault/design-system';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { getWhatsNewRelease, type WhatsNewSlideEntry } from '../../data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useWhatsNewStore } from '../../stores/whats-new.store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH;

export default function WhatsNewModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const setLastSeenVersion = useWhatsNewStore((s) => s.setLastSeenVersion);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<WhatsNewSlideEntry>>(null);

  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
  const release = getWhatsNewRelease(currentVersion);
  const slides = release?.slides ?? [];

  const isLastSlide = activeIndex === slides.length - 1;

  const dismiss = useCallback(() => {
    setLastSeenVersion(currentVersion);
    trackEvent(AnalyticsEvent.WHATS_NEW_DISMISSED, {
      version: currentVersion,
      last_slide_index: activeIndex,
      completed_all: activeIndex === slides.length - 1,
    });
    router.back();
  }, [currentVersion, activeIndex, slides.length, setLastSeenVersion, router]);

  const handleNext = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isLastSlide) {
      dismiss();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [activeIndex, isLastSlide, dismiss]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<WhatsNewSlideEntry>[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = useCallback(
    ({ item }: ListRenderItemInfo<WhatsNewSlideEntry>) => {
      const Icon = item.icon;
      return (
        <View
          style={{
            width: SLIDE_WIDTH,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
          }}
        >
          <Animated.View entering={FadeInUp.delay(100).duration(250)}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                borderCurve: 'continuous',
                backgroundColor: item.iconBgColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Icon size={40} color={item.iconColor} />
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(200).duration(250)}
            style={{
              fontSize: 24,
              fontWeight: '800',
              color: palette.neutral900,
              textAlign: 'center',
              marginBottom: 12,
              letterSpacing: -0.3,
            }}
          >
            {t(item.titleKey)}
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(300).duration(250)}
            style={{
              fontSize: 16,
              color: palette.neutral500,
              textAlign: 'center',
              lineHeight: 24,
              maxWidth: 300,
            }}
          >
            {t(item.descriptionKey)}
          </Animated.Text>
        </View>
      );
    },
    [t],
  );

  // Safety net — NavigationGate already prevents opening without release data
  if (slides.length === 0) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.white }}>
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: palette.primary500,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {t('whatsNew.badge')}
        </Text>
        <Pressable
          onPress={dismiss}
          hitSlop={16}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 1,
            padding: 4,
          })}
        >
          <X size={22} color={palette.neutral400} />
        </Pressable>
      </Animated.View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => `slide-${i}`}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
      />

      {/* Footer: dots + button */}
      <Animated.View
        entering={FadeIn.delay(400).duration(250)}
        style={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        {/* Dot indicators */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 24,
          }}
        >
          {slides.map((slide, i) => (
            <View
              key={slide.titleKey}
              style={{
                width: i === activeIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                borderCurve: 'continuous',
                backgroundColor: i === activeIndex ? palette.primary500 : palette.neutral200,
              }}
            />
          ))}
        </View>

        {/* CTA Button */}
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => ({
            backgroundColor: palette.neutral900,
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
            {isLastSlide ? t('whatsNew.getStarted') : t('whatsNew.next')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
