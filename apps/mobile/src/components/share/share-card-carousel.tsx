import { memo, useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
import { ShareCardPreview } from './cards/share-card-preview';
import type { CardVariant, RideSharePayload } from './share-card-types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = 222;
const CARD_GAP = 14;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

interface ShareCardCarouselProps {
  variants: CardVariant[];
  payload: RideSharePayload;
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

export const ShareCardCarousel = memo(function ShareCardCarousel({
  variants,
  payload,
  activeIndex,
  onIndexChange,
}: ShareCardCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);

  const snapOffsets = variants.map((_, i) => i * (CARD_WIDTH + CARD_GAP));

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const index = Math.round(offset / (CARD_WIDTH + CARD_GAP));
      const clamped = Math.max(0, Math.min(index, variants.length - 1));
      onIndexChange(clamped);
    },
    [variants.length, onIndexChange],
  );

  const handleDotPress = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({
        x: index * (CARD_WIDTH + CARD_GAP),
        animated: true,
      });
      onIndexChange(index);
    },
    [onIndexChange],
  );

  return (
    <View>
      {/* Carousel */}
      <View style={{ height: 416, overflow: 'hidden' }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToOffsets={snapOffsets}
          snapToAlignment="start"
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PADDING,
            paddingTop: 12,
          }}
        >
          {variants.map((variant, i) => (
            <View
              key={variant}
              style={{
                width: CARD_WIDTH,
                marginRight: i < variants.length - 1 ? CARD_GAP : 0,
              }}
            >
              <ShareCardPreview variant={variant} payload={payload} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Page dots */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          justifyContent: 'center',
          paddingVertical: 12,
        }}
      >
        {variants.map((variant, i) => (
          <Pressable
            key={variant}
            onPress={() => handleDotPress(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Card ${i + 1} of ${variants.length}`}
          >
            <View
              style={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: 99,
                backgroundColor:
                  i === activeIndex ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.25)',
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
});

export { CARD_WIDTH, CARD_GAP };
