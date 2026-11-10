import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { PixelRatio, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useEditorialTheme } from '@/theme/editorial';

/** Captures already taken this session, by cache key, so a revisit shows the blur at once. */
const captures = new Map<string, string>();

/** Clears the in-memory capture cache (tests). */
export function clearBlurCaptures(): void {
  captures.clear();
}

/**
 * A short stable hash of a teaser's data, for the capture cache key. Not
 * cryptographic: it only has to change when the teaser does.
 */
export function teaserHash(value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** The capture cache key: the teaser data, the scheme and the font scale all change the picture. */
export function blurCaptureKey(parts: {
  row: string;
  data: unknown;
  isDark: boolean;
  fontScale: number;
}): string {
  return [parts.row, teaserHash(parts.data), parts.isDark ? 'dark' : 'light', parts.fontScale].join(
    '|',
  );
}

interface BlurCaptureProps {
  cacheKey: string;
  width: number;
  height: number;
  /** Blur in points (screen units), whatever the device's pixel ratio. */
  blurRadius: number;
  /** The teaser view: coarse shapes only, never a value a free rider may not see. */
  children: ReactNode;
}

/**
 * A locked row's teaser, blurred. The real view is drawn once under an opaque
 * placeholder, captured to an image, and shown only through `blurRadius`; until
 * the capture exists the rider sees the placeholder, never the clear view. Both
 * the captured view and the image are hidden from VoiceOver and TalkBack.
 */
export function BlurCapture({ cacheKey, width, height, blurRadius, children }: BlurCaptureProps) {
  const { t } = useEditorialTheme();
  const [uri, setUri] = useState<string | null>(() => captures.get(cacheKey) ?? null);
  const [capturedKey, setCapturedKey] = useState(cacheKey);
  const sourceRef = useRef<View>(null);
  /** The key on screen now: a capture that lands for an older key must not show under it. */
  const keyRef = useRef(cacheKey);
  keyRef.current = cacheKey;
  /** Whether the source view has been laid out and is still mounted under the placeholder. */
  const sourceLaidOut = useRef(false);
  const inFlightKey = useRef<string | null>(null);

  // A new key (theme, font scale or data changed) starts over from the placeholder.
  if (capturedKey !== cacheKey) {
    setCapturedKey(cacheKey);
    setUri(captures.get(cacheKey) ?? null);
  }

  const capture = useCallback(async () => {
    sourceLaidOut.current = true;
    if (captures.has(cacheKey) || inFlightKey.current === cacheKey) return;
    inFlightKey.current = cacheKey;
    try {
      const result = await captureRef(sourceRef, { format: 'png', result: 'tmpfile' });
      captures.set(cacheKey, result);
      if (keyRef.current !== cacheKey) return;
      sourceLaidOut.current = false;
      setUri(result);
    } catch {
      // The placeholder stays: a failed capture must never fall back to the clear view.
    } finally {
      if (inFlightKey.current === cacheKey) inFlightKey.current = null;
    }
  }, [cacheKey]);

  // The key changed while the placeholder showed: the source view stays mounted,
  // so no new layout fires, and the new picture is captured here instead.
  useEffect(() => {
    if (sourceLaidOut.current && !captures.has(cacheKey)) void capture();
  }, [cacheKey, capture]);

  const box = { width, height };

  if (uri) {
    return (
      <Image
        testID="blur-capture-image"
        source={{ uri }}
        // The capture is at device pixels and the image blurs in image pixels, so
        // the radius is scaled to read as `blurRadius` points on screen.
        blurRadius={blurRadius * PixelRatio.get()}
        style={box}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  return (
    <View
      style={box}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        testID="blur-capture-source"
        ref={sourceRef}
        collapsable={false}
        style={box}
        onLayout={() => void capture()}
      >
        {children}
      </View>
      <View
        testID="blur-capture-placeholder"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          borderRadius: height / 2,
          borderCurve: 'continuous',
          backgroundColor: t.surface2,
        }}
      />
    </View>
  );
}
