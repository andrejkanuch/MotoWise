import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { SYSTEM_WEIGHT, type } from '@/theme/type';
import { BlurCapture } from './blur-capture';

/** From this font scale a row stacks its graphic under the text, so values never truncate. */
export const STACK_FONT_SCALE = 1.5;
const ROW_MIN_HEIGHT = 76;
/** The mini graphic beside a row's text. */
export const MINI_WIDTH = 96;
const PRESS_TINT = 0.06;
const TEXT_GAP = 2;

export function isStackedRow(fontScale: number): boolean {
  return fontScale >= STACK_FONT_SCALE;
}

interface RowShellProps {
  testID: string;
  accessibilityLabel: string;
  /** Hint read after the label (what a tap does). */
  accessibilityHint?: string;
  onPress?: () => void;
  /** The text column: title, value, caption. */
  children: ReactNode;
  /** The mini graphic, if any. */
  graphic?: ReactNode;
  /** The trailing affordance: a chevron or "Unlock". */
  trailing?: ReactNode;
}

/**
 * One "How you ride" row: an inset grouped row, 76 high, text column first,
 * then the mini graphic and the trailing affordance. Stacks from font scale
 * 1.5 so a long value wraps instead of being cut.
 */
export function RowShell({
  testID,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  children,
  graphic,
  trailing,
}: RowShellProps) {
  const { t } = useEditorialTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = isStackedRow(fontScale);

  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={onPress ? { color: t.line } : undefined}
      style={({ pressed }) => ({
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        gap: space.sm,
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'center',
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, PRESS_TINT) : 'transparent',
      })}
    >
      <View
        testID={`${testID}-text`}
        style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: TEXT_GAP }}
      >
        {children}
      </View>
      {graphic || trailing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {graphic}
          {trailing}
        </View>
      ) : null}
    </Pressable>
  );
}

interface LockedRowProps {
  testID: string;
  title: string;
  /** What Pro shows here, in words; never a value. */
  teaser: string;
  /** The teaser graphic (coarse shapes only), captured and shown blurred. */
  graphic: ReactNode;
  graphicHeight: number;
  captureKey: string;
  blurRadius: number;
  /** The rider just bought Pro and the server has not caught up: no paywall, a short wait. */
  unlocking: boolean;
  onShown: () => void;
  onUnlock: () => void;
}

/**
 * A Pro row for a rider without Pro: the row's own pattern, blurred, and
 * "Unlock", which opens the paywall. VoiceOver hears the row's name only.
 */
export function LockedRow({
  testID,
  title,
  teaser,
  graphic,
  graphicHeight,
  captureKey,
  blurRadius,
  unlocking,
  onShown,
  onUnlock,
}: LockedRowProps) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: once per mount, i.e. per screen visit
  useEffect(() => {
    onShown();
  }, []);

  return (
    <RowShell
      testID={testID}
      accessibilityLabel={
        unlocking
          ? i18n('riderInsights.howYouRide.unlockingA11y', { title })
          : i18n('riderInsights.howYouRide.lockedA11y', { title })
      }
      onPress={unlocking ? undefined : onUnlock}
      graphic={
        <BlurCapture
          cacheKey={captureKey}
          width={MINI_WIDTH}
          height={graphicHeight}
          blurRadius={blurRadius}
        >
          {graphic}
        </BlurCapture>
      }
      trailing={
        <Text
          style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: unlocking ? t.ink3 : t.warm2 }]}
        >
          {unlocking
            ? i18n('riderInsights.howYouRide.unlocking')
            : i18n('riderInsights.howYouRide.unlock')}
        </Text>
      }
    >
      <Text style={[type.body, { color: t.ink }]}>{title}</Text>
      <Text style={[type.subhead, { color: t.ink2 }]}>{teaser}</Text>
    </RowShell>
  );
}
