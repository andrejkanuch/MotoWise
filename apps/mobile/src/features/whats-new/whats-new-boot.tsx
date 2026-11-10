/**
 * The What's New boot: about two seconds of an instrument cluster waking up.
 * The gauge needle sweeps, the warning lamps light and go out, the odometer
 * rolls to the rider's season distance (else the primary bike's odometer, else
 * it is left out), and it closes on "All systems OK" with the page count.
 *
 * Only current-release pages are called new; catch-up pages are counted apart,
 * and with no current-release page the line never says "new".
 *
 * A deliberate exception to the short-animation rule: it runs once per store
 * update, any tap ends it, and under reduced motion the final frame is shown
 * still for the same time. Screen readers get one summary label and a Skip
 * button; the instruments themselves are hidden.
 */

import { Check, Droplet } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WHATS_NEW_TIMING } from '@/config/whats-new';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { BootGauge } from './boot-gauge';
import { BOOT_KIND, type BootData } from './build-boot-snapshot';
import { OdometerRoll } from './odometer-roll';

export interface WhatsNewBootResult {
  /** The rider tapped to end it early. */
  skipped: boolean;
  /** How long it was on screen. */
  elapsedMs: number;
}

export interface WhatsNewBootProps {
  boot: BootData;
  /** Pages from the current release. */
  newCount: number;
  /** Pages from earlier releases the rider has not seen. */
  catchUpCount: number;
  /** Called once: at the end of the boot, or on the first tap. */
  onDone: (result: WhatsNewBootResult) => void;
}

const GAUGE_MAX = 300;
/** The lamps light just after the needle starts and go out as it returns. */
const LAMP_ON_DELAY_MS = 150;
const LAMP_ON_MS = 60;
const LAMP_OFF_DELAY_MS = 690;
const LAMP_OFF_MS = 200;
const LAMP_OUT_OPACITY = 0.1;
const LAMP_SIZE = 30;
const LAMP_ICON = 22;
const CHECK_ICON = 16;
const CHECK_STROKE = 2.6;
const SKIP_HIT_SLOP = space.xs;
const CAPTION_DELAY_MS = 1300;
const STATUS_DELAY_MS = 950;
const REVEAL_MS = 260;

const LAMP = { NEUTRAL: 'neutral', OIL: 'oil', ABS: 'abs' } as const;
type Lamp = (typeof LAMP)[keyof typeof LAMP];
const LAMPS: readonly Lamp[] = [LAMP.NEUTRAL, LAMP.OIL, LAMP.ABS];
/** Printed on the lamp glass, like the real tell-tales: not translated. */
const LAMP_GLYPH = { [LAMP.NEUTRAL]: 'N', [LAMP.ABS]: 'ABS' } as const;

function LampFace({ lamp, color }: { lamp: Lamp; color: string }) {
  if (lamp === LAMP.OIL) return <Droplet size={LAMP_ICON} color={color} />;
  return <Text style={[type.figureSmall, SYSTEM_WEIGHT.bold, { color }]}>{LAMP_GLYPH[lamp]}</Text>;
}

function BlinkingLamp({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(LAMP_OUT_OPACITY);

  useEffect(() => {
    opacity.value = withSequence(
      withDelay(LAMP_ON_DELAY_MS, withTiming(1, { duration: LAMP_ON_MS })),
      withDelay(LAMP_OFF_DELAY_MS, withTiming(LAMP_OUT_OPACITY, { duration: LAMP_OFF_MS })),
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View testID="whats-new-boot-lamp" style={[LAMP_BOX, style]}>
      {children}
    </Animated.View>
  );
}

const LAMP_BOX = {
  width: LAMP_SIZE,
  height: LAMP_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** Fades its children in after `delay`; still under reduced motion. */
function Reveal({
  delay,
  reduceMotion,
  children,
}: {
  delay: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withDelay(delay, withTiming(1, { duration: REVEAL_MS }));
  }, [opacity, delay, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (reduceMotion) return <View style={CENTERED}>{children}</View>;
  return <Animated.View style={[CENTERED, style]}>{children}</Animated.View>;
}

const CENTERED = { alignItems: 'center' } as const;

export function WhatsNewBoot({ boot, newCount, catchUpCount, onDone }: WhatsNewBootProps) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gaugeSize = Math.min(GAUGE_MAX, width - 2 * layout.screenGutter);

  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback((skipped: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current({ skipped, elapsedMs: Date.now() - startedAtRef.current });
  }, []);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => finish(false), WHATS_NEW_TIMING.BOOT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [finish]);

  const skip = () => finish(true);

  const odometer =
    boot.kind === BOOT_KIND.NONE
      ? null
      : {
          value: boot.value,
          figure: boot.figure,
          unitLabel: boot.unitLabel,
          label: tr(
            boot.kind === BOOT_KIND.SEASON
              ? 'whatsNew.carousel.boot.season'
              : 'whatsNew.carousel.boot.odo',
          ),
          caption:
            boot.kind === BOOT_KIND.SEASON
              ? tr('whatsNew.carousel.boot.seasonCaption', { count: boot.rides })
              : tr('whatsNew.carousel.boot.fromGarage', { bike: boot.bikeName }),
        };

  const newLine = newCount > 0 ? tr('whatsNew.carousel.boot.newCount', { count: newCount }) : null;
  const catchUpLine =
    catchUpCount > 0
      ? tr(newLine ? 'whatsNew.carousel.boot.catchUpCount' : 'whatsNew.carousel.boot.catchUpOnly', {
          count: catchUpCount,
        })
      : null;
  const countLine = [newLine, catchUpLine].filter(Boolean).join(' ');
  const allSystemsOk = tr('whatsNew.carousel.boot.allSystemsOk');

  const summary = [
    allSystemsOk,
    odometer ? `${odometer.label} ${odometer.figure} ${odometer.unitLabel}` : null,
    odometer?.caption,
    countLine,
  ]
    .filter(Boolean)
    .join('. ');

  const lampColor: Record<Lamp, string> = {
    [LAMP.NEUTRAL]: t.success,
    [LAMP.OIL]: t.dueInk,
    [LAMP.ABS]: t.dueInk,
  };

  return (
    <Pressable
      testID="whats-new-boot"
      accessible={false}
      onPress={skip}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View
        testID="whats-new-boot-summary"
        accessible
        accessibilityLabel={summary}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: layout.sectionGap,
          paddingHorizontal: layout.screenGutter,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ alignItems: 'center', gap: layout.sectionGap }}
        >
          <BootGauge size={gaugeSize} reduceMotion={reduceMotion} />
          {odometer ? (
            <View style={{ alignItems: 'center', gap: layout.labelGap }}>
              <OdometerRoll
                value={odometer.value}
                label={odometer.label}
                unitLabel={odometer.unitLabel}
                reduceMotion={reduceMotion}
              />
              <Reveal delay={CAPTION_DELAY_MS} reduceMotion={reduceMotion}>
                <Text style={[type.label, { color: t.ink2 }]}>{odometer.caption}</Text>
              </Reveal>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            {LAMPS.map((lamp) =>
              reduceMotion ? (
                <View key={lamp} style={[LAMP_BOX, { opacity: LAMP_OUT_OPACITY }]}>
                  <LampFace lamp={lamp} color={lampColor[lamp]} />
                </View>
              ) : (
                <BlinkingLamp key={lamp}>
                  <LampFace lamp={lamp} color={lampColor[lamp]} />
                </BlinkingLamp>
              ),
            )}
          </View>
          <Reveal delay={STATUS_DELAY_MS} reduceMotion={reduceMotion}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Check size={CHECK_ICON} color={t.success} strokeWidth={CHECK_STROKE} />
              <Text style={[type.subhead, { color: t.ink2 }]}>{allSystemsOk}</Text>
            </View>
            {countLine ? (
              <Text style={[type.bodyStrong, { color: t.ink, textAlign: 'center' }]}>
                {countLine}
              </Text>
            ) : null}
          </Reveal>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('whatsNew.carousel.boot.skip')}
        onPress={skip}
        hitSlop={SKIP_HIT_SLOP}
        style={{
          position: 'absolute',
          top: insets.top + space.xs,
          right: layout.screenGutter,
          paddingHorizontal: space.md,
          paddingVertical: space.xs,
          borderRadius: radius.pill,
          backgroundColor: t.surface2,
        }}
      >
        <Text style={[type.label, { color: t.ink }]}>{tr('whatsNew.carousel.boot.skip')}</Text>
      </Pressable>
    </Pressable>
  );
}
