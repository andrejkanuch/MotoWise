import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShareCardCarousel } from './share-card-carousel';
import {
  type CardVariant,
  getAvailableVariants,
  getInitialCardIndex,
  type RideSharePayload,
  type ShareDestination,
} from './share-card-types';
import { ShareDestinationGrid } from './share-destination-grid';

interface ShareActivitySheetProps {
  visible: boolean;
  payload: RideSharePayload;
  onClose: () => void;
  onDestinationPress: (destination: ShareDestination, variant: CardVariant) => void;
}

export function ShareActivitySheet({
  visible,
  payload,
  onClose,
  onDestinationPress,
}: ShareActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const hasAutoSelected = useRef(false);

  const variants = getAvailableVariants(payload);
  const [activeIndex, setActiveIndex] = useState(() => getInitialCardIndex(variants, payload));

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

  // Reset auto-select guard when sheet closes
  useEffect(() => {
    if (!visible) {
      hasAutoSelected.current = false;
    }
  }, [visible]);

  const handleDestinationPress = useCallback(
    (destination: ShareDestination) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const activeVariant = variants[activeIndex] ?? variants[0];
      onDestinationPress(destination, activeVariant);
    },
    [activeIndex, variants, onDestinationPress],
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
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(8,6,4,0.62)',
          }}
        />
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

          {/* Empty spacer for centering */}
          <View style={{ width: 40 }} />
        </View>

        {/* Carousel */}
        <ShareCardCarousel
          variants={variants}
          payload={payload}
          activeIndex={activeIndex}
          onIndexChange={setActiveIndex}
        />

        {/* Destination Grid */}
        <ShareDestinationGrid disabled={false} onDestinationPress={handleDestinationPress} />

        {/* Safe area bottom */}
        <View style={{ height: insets.bottom }} />
      </Animated.View>
    </View>
  );
}
