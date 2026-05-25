import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { ShareCardCarousel } from './share-card-carousel';
import {
  getAvailableVariants,
  getInitialCardIndex,
  type RideSharePayload,
  type ShareDestination,
} from './share-card-types';
import { ShareDestinationGrid } from './share-destination-grid';
import { executeShareDestination, getToastMessage } from './share-destinations';
import { ShareToast } from './share-toast';
import { useSharePipeline } from './use-share-pipeline';

interface ShareActivitySheetProps {
  visible: boolean;
  payload: RideSharePayload;
  onClose: () => void;
}

export function ShareActivitySheet({ visible, payload, onClose }: ShareActivitySheetProps) {
  const insets = useSafeAreaInsets();

  const variants = getAvailableVariants(payload);
  const [activeIndex, setActiveIndex] = useState(() => getInitialCardIndex(variants, payload));
  const [toastKey, setToastKey] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastKey((k) => k + 1);
  }, []);

  const handleHandoff = useCallback(
    async (destination: ShareDestination, imageUri: string) => {
      const activeVariant = variants[activeIndex] ?? variants[0];
      trackEvent(AnalyticsEvent.SHARE_COMPLETED, { destination, variant: activeVariant });

      const result = await executeShareDestination(destination, imageUri, payload.rideId);
      const toast = getToastMessage(destination, result);
      if (toast) showToast(toast);
      return result;
    },
    [activeIndex, variants, payload.rideId, showToast],
  );

  const { isIdle, activeCardRef, handleDestinationTap } = useSharePipeline({
    rideId: payload.rideId,
    onHandoff: handleHandoff,
  });

  // Track sheet open
  useEffect(() => {
    if (visible) {
      trackEvent(AnalyticsEvent.SHARE_SHEET_OPENED, {});
    }
  }, [visible]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      setToastMessage(null);
    }
  }, [visible]);

  const handleIndexChange = useCallback(
    (index: number) => {
      setActiveIndex(index);
      if (variants[index]) {
        trackEvent(AnalyticsEvent.SHARE_CARD_SWIPED, { variant: variants[index] });
      }
    },
    [variants],
  );

  const handleDestinationPress = useCallback(
    (destination: ShareDestination) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const activeVariant = variants[activeIndex] ?? variants[0];
      trackEvent(AnalyticsEvent.SHARE_DESTINATION_TAPPED, { destination, variant: activeVariant });
      handleDestinationTap(destination, activeVariant);
    },
    [activeIndex, variants, handleDestinationTap],
  );

  const handleClose = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55 }}>
      {/* Scrim */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Pressable onPress={handleClose} style={{ flex: 1, backgroundColor: 'rgba(8,6,4,0.62)' }} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInUp.duration(300).damping(20)}
        exiting={SlideOutDown.duration(250)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: 134,
          backgroundColor: palette.shareSheetBg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {/* Handle */}
        <View
          style={{
            width: 38,
            height: 4,
            borderRadius: 99,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignSelf: 'center',
            marginTop: 7,
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 12,
          }}
        >
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: -0.05,
              }}
            >
              Close
            </Text>
          </Pressable>

          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: palette.shareTextLight,
              letterSpacing: -0.22,
            }}
          >
            Share Ride
          </Text>

          <View style={{ width: 40, alignItems: 'flex-end' }}>
            {!isIdle && <ActivityIndicator size="small" color={palette.shareCopperSoft} />}
          </View>
        </View>

        {/* Carousel — active card ref wired for view-shot capture */}
        <ShareCardCarousel
          variants={variants}
          payload={payload}
          activeIndex={activeIndex}
          activeCardRef={activeCardRef}
          onIndexChange={handleIndexChange}
        />

        {/* Destination Grid */}
        <ShareDestinationGrid disabled={!isIdle} onDestinationPress={handleDestinationPress} />

        {/* Toast */}
        <ShareToast key={toastKey} message={toastMessage} />

        {/* Safe area bottom */}
        <View style={{ height: insets.bottom }} />
      </Animated.View>
    </View>
  );
}
