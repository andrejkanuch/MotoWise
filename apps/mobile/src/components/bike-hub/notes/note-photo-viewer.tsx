import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerImpact } from '../../../utils/haptics';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_FONT, HUB_TOUCH_TARGET, hub } from '../ui/tokens';
import { type NotePhotoSource, notePhotoUri } from './note-photo';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SNAP_MS = 220;
/** A vertical drag past this distance (or flung faster than the velocity) closes the viewer. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const FADE_IN_MS = 180;

export interface ViewerPhoto extends NotePhotoSource {
  id: string;
}

interface NotePhotoViewerProps {
  photos: readonly ViewerPhoto[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Full-screen viewer of a note's photos (at most three) on the dark ground:
 * swipe sideways between them, pinch or double-tap to zoom, drag down (or the
 * close button, or system Back) to dismiss. Draws the same uri as the row's
 * thumbnail — the rider's local file when this session uploaded it — so the
 * photo is usually on screen at once.
 */
export function NotePhotoViewer({ photos, initialIndex, onClose }: NotePhotoViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const count = photos.length;

  const onPageEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View
      testID="note-photo-viewer"
      accessibilityViewIsModal
      style={{ flex: 1, backgroundColor: hub.ground }}
    >
      <StatusBar style="light" />
      <FlatList
        data={photos}
        keyExtractor={(photo) => photo.id}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed && count > 1}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, item) => ({ length: width, offset: width * item, index: item })}
        onMomentumScrollEnd={onPageEnd}
        renderItem={({ item, index: page }) => (
          <ZoomablePhoto
            uri={notePhotoUri(item)}
            width={width}
            height={height}
            label={t('bikeHub.notesScreen.photoOf', { index: page + 1, count })}
            onZoomChange={setZoomed}
            onDismiss={onClose}
          />
        )}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          minHeight: HUB_TOUCH_TARGET,
          paddingHorizontal: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          testID="note-photo-viewer-close"
          onPress={() => {
            triggerImpact();
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('bikeHub.notesScreen.viewerCloseA11y')}
          style={({ pressed }) => ({
            width: HUB_TOUCH_TARGET,
            height: HUB_TOUCH_TARGET,
            borderRadius: HUB_TOUCH_TARGET / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hub.photoChip,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <X size={22} color={hub.text} strokeWidth={2.2} />
        </Pressable>
        {count > 1 ? (
          <Text
            testID="note-photo-viewer-counter"
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
            style={{
              flex: 1,
              marginRight: HUB_TOUCH_TARGET,
              textAlign: 'center',
              fontFamily: HUB_FONT.mono,
              fontSize: 13,
              color: hub.text,
            }}
          >
            {t('bikeHub.notesScreen.viewerCounter', { index: index + 1, count })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

interface ZoomablePhotoProps {
  uri: string;
  width: number;
  height: number;
  label: string;
  onZoomChange: (zoomed: boolean) => void;
  onDismiss: () => void;
}

/**
 * One page: pinch and double-tap zoom, pan while zoomed (kept inside the
 * photo's edges), and drag down to dismiss while not zoomed. Paging belongs to
 * the list, so the pans only run when they cannot steal a sideways swipe.
 */
function ZoomablePhoto({ uri, width, height, label, onZoomChange, onDismiss }: ZoomablePhotoProps) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dragY = useSharedValue(0);

  const reportZoom = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        tx.value = withTiming(0, { duration: SNAP_MS });
        ty.value = withTiming(0, { duration: SNAP_MS });
      }
      runOnJS(reportZoom)(scale.value > 1);
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((event) => {
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      tx.value = Math.min(maxX, Math.max(-maxX, startX.value + event.translationX));
      ty.value = Math.min(maxY, Math.max(-maxY, startY.value + event.translationY));
    });

  const dismiss = Gesture.Pan()
    .enabled(!zoomed)
    .activeOffsetY([-14, 14])
    .failOffsetX([-14, 14])
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationY) > DISMISS_DISTANCE;
      const fast = Math.abs(event.velocityY) > DISMISS_VELOCITY;
      if (far || fast) {
        runOnJS(onDismiss)();
        return;
      }
      dragY.value = withTiming(0, { duration: SNAP_MS });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.value <= 1;
      const target = zoomIn ? DOUBLE_TAP_ZOOM : 1;
      scale.value = withTiming(target, { duration: SNAP_MS });
      savedScale.value = target;
      tx.value = withTiming(0, { duration: SNAP_MS });
      ty.value = withTiming(0, { duration: SNAP_MS });
      runOnJS(reportZoom)(zoomIn);
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan, dismiss));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(0.6, Math.abs(dragY.value) / (height * 0.8)),
    transform: [
      { translateX: tx.value },
      { translateY: ty.value + dragY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height, justifyContent: 'center' }, imageStyle]}>
        <Image
          source={{ uri }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          transition={FADE_IN_MS}
          contentFit="contain"
          style={{ width, height }}
        />
      </Animated.View>
    </GestureDetector>
  );
}
