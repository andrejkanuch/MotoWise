import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { type LayoutChangeEvent, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { ONBOARDING_COLORS } from './onboarding-colors';

/**
 * Variant B's commitment gesture: a drawn signature. Higher effort than A's
 * press-and-hold (effort justification right before the paywall). Strokes are
 * captured purely client-side — the path is never persisted or uploaded; it
 * only exists to make the rider physically sign their pledge.
 *
 * Re-renders are scoped to this component (the active stroke updates on every
 * pan frame) so the commitment screen above it stays still while drawing.
 */
export interface SignaturePadHandle {
  clear: () => void;
}

interface SignaturePadProps {
  /** Stroke + baseline accent (the bike's brand color). */
  color: string;
  /** "Sign here" placeholder shown until the first stroke. */
  hint: string;
  height?: number;
  /**
   * Minimum cumulative stroke length (px) before the signature counts — guards
   * against an accidental dot enabling the Seal action.
   */
  minLength?: number;
  disabled?: boolean;
  /** Fires when the signature crosses (or drops back under) the length threshold. */
  onSignedChange: (signed: boolean) => void;
}

const STROKE_WIDTH = 2.5;
const DEFAULT_HEIGHT = 168;
const DEFAULT_MIN_LENGTH = 60;

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  (
    {
      color,
      hint,
      height = DEFAULT_HEIGHT,
      minLength = DEFAULT_MIN_LENGTH,
      disabled,
      onSignedChange,
    },
    ref,
  ) => {
    // Completed strokes (committed on pen-up) + the active stroke being drawn.
    const [strokes, setStrokes] = useState<string[]>([]);
    const [activePath, setActivePath] = useState('');
    const [width, setWidth] = useState(0);

    // Tracked outside render: cumulative length + last point of the active stroke.
    const lengthRef = useRef(0);
    const signedRef = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);

    const updateSigned = (next: boolean) => {
      if (signedRef.current === next) return;
      signedRef.current = next;
      onSignedChange(next);
    };

    const reset = useCallback(() => {
      setStrokes([]);
      setActivePath('');
      lengthRef.current = 0;
      lastPoint.current = null;
      if (signedRef.current) {
        signedRef.current = false;
        onSignedChange(false);
      }
    }, [onSignedChange]);

    useImperativeHandle(ref, () => ({ clear: reset }), [reset]);

    const beginStroke = (x: number, y: number) => {
      lastPoint.current = { x, y };
      setActivePath(`M${x.toFixed(1)},${y.toFixed(1)}`);
    };

    const extendStroke = (x: number, y: number) => {
      const prev = lastPoint.current;
      if (prev) {
        lengthRef.current += Math.hypot(x - prev.x, y - prev.y);
        if (lengthRef.current >= minLength) updateSigned(true);
      }
      lastPoint.current = { x, y };
      setActivePath((d) => `${d} L${x.toFixed(1)},${y.toFixed(1)}`);
    };

    const commitStroke = () => {
      setActivePath((d) => {
        if (d) setStrokes((prev) => [...prev, d]);
        return '';
      });
      lastPoint.current = null;
    };

    const pan = Gesture.Pan()
      .enabled(!disabled)
      .maxPointers(1)
      .minDistance(0)
      .onBegin((e) => {
        runOnJS(beginStroke)(e.x, e.y);
      })
      .onUpdate((e) => {
        runOnJS(extendStroke)(e.x, e.y);
      })
      .onEnd(() => {
        runOnJS(commitStroke)();
      });

    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
    const isEmpty = strokes.length === 0 && activePath === '';

    return (
      <GestureDetector gesture={pan}>
        <View
          onLayout={onLayout}
          accessibilityRole="image"
          accessibilityLabel={hint}
          style={{
            height,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: ONBOARDING_COLORS.cardBg,
            borderWidth: 1,
            borderColor: ONBOARDING_COLORS.cardBorderDefault,
          }}
        >
          {width > 0 ? (
            <Svg width={width} height={height}>
              {/* signature baseline */}
              <Line
                x1={24}
                y1={height - 34}
                x2={width - 24}
                y2={height - 34}
                stroke={color}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="2 5"
              />
              {strokes.map((d, i) => (
                <Path
                  // biome-ignore lint/suspicious/noArrayIndexKey: strokes is append-only, reset wholesale on clear
                  key={`stroke-${i}`}
                  d={d}
                  stroke={color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {activePath ? (
                <Path
                  d={activePath}
                  stroke={color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
            </Svg>
          ) : null}

          {isEmpty ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 40,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Italic',
                  fontSize: 18,
                  color: ONBOARDING_COLORS.textMuted,
                }}
              >
                {hint}
              </Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
