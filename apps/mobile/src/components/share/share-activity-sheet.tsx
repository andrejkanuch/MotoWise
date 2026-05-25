import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const hasAutoSelected = useRef(false);

  const variants = getAvailableVariants(payload);
  const [activeIndex, setActiveIndex] = useState(() => getInitialCardIndex(variants, payload));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleHandoff = useCallback(
    async (destination: ShareDestination, imageUri: string) => {
      const activeVariant = variants[activeIndex] ?? variants[0];
      trackEvent(AnalyticsEvent.SHARE_COMPLETED, {
        destination,
        variant: activeVariant,
      });

      const result = await executeShareDestination(destination, imageUri, payload.rideId);
      const toast = getToastMessage(destination, result);
      if (toast) setToastMessage(toast);
      return result;
    },
    [activeIndex, variants, payload.rideId],
  );

  const { isIdle, handleDestinationTap } = useSharePipeline({
    rideId: payload.rideId,
    onHandoff: handleHandoff,
  });

  // Auto-select PB card on initial mount only
  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (payload.isPB && payload.pbType === 'topSpeed') {
      const pbIndex = variants.indexOf('pbSpotlight');
      if (pbIndex >= 0) {
        setActiveIndex(pbIndex);
        hasAutoSelected.current = true;
      }
    }
  }, [payload.isPB, payload.pbType, variants]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      hasAutoSelected.current = false;
      setToastMessage(null);
    }
  }, [visible]);

  const handleDestinationPress = useCallback(
    (destination: ShareDestination) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const activeVariant = variants[activeIndex] ?? variants[0];
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
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 55,
      }}
    >
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

          {/* Loading indicator when capturing */}
          <View style={{ width: 40, alignItems: 'flex-end' }}>
            {!isIdle && <ActivityIndicator size="small" color={palette.shareCopperSoft} />}
          </View>
        </View>

        {/* Carousel */}
        <ShareCardCarousel
          variants={variants}
          payload={payload}
          activeIndex={activeIndex}
          onIndexChange={setActiveIndex}
        />

        {/* Destination Grid */}
        <ShareDestinationGrid disabled={!isIdle} onDestinationPress={handleDestinationPress} />

        {/* Toast */}
        <ShareToast message={toastMessage} />

        {/* Safe area bottom */}
        <View style={{ height: insets.bottom }} />
      </Animated.View>
    </View>
  );
}
