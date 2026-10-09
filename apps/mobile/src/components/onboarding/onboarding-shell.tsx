import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, Text, View, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OnboardingRoute } from '../../config/onboarding';
import { useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { GUTTER, radius, space, type } from '../../theme/type';
import { useOnboardingColors } from './onboarding-colors';
import { FOOTER_MAX_FONT_SCALE, OnboardingContinueButton } from './onboarding-continue-button';

const TOP_BAR_HEIGHT = 44;
const TRACK_HEIGHT = 3;
const TRACK_MS = 240;
const EASE_OUT = Easing.out(Easing.exp);
/**
 * Room kept between the sticky footer and the focused input's caret: half a
 * 52pt field, the gap and the next field's label, so the rider (and Maestro's
 * "Email" → "Password" taps) can always reach the next field above the footer.
 */
const CARET_CLEARANCE = space.xxxl + space.xl;

export interface OnboardingAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Primary only: the leading arrow icon (default on). */
  showIcon?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export interface OnboardingShellProps {
  /** Flow position for the progress track. Omit for screens outside the flow. */
  screen?: OnboardingRoute;
  /** Back control. Omit to hide it (non-reversible steps). */
  onBack?: () => void;
  /** The step's question — one condensed large title. */
  title?: string;
  /** One optional system-face line under the title. */
  subtitle?: string;
  /** Copper 52pt primary action in the sticky footer. */
  primary?: OnboardingAction;
  /** Quiet text action under the primary. Hidden while the keyboard is up, so the footer stays one button tall above it. */
  secondary?: OnboardingAction;
  /** Footer content in place of / above the actions (e.g. an affirmation or caption). */
  footer?: ReactNode;
  /** Wrap content in a ScrollView (default). Set false for screens that lay out their own list. */
  scroll?: boolean;
  /** Extra style for the content area. */
  contentStyle?: ViewStyle;
  children?: ReactNode;
  testID?: string;
}

/**
 * The one onboarding frame (Race Plate): a top bar with a 44pt back control and
 * a thin copper progress track, a condensed title + optional subhead, the step's
 * content, and a sticky, keyboard-aware footer holding the copper primary and an
 * optional text action. Every onboarding and account step renders inside it.
 *
 * Keyboard: the footer rides on top of the keyboard (`KeyboardStickyView`) and
 * the content is a `KeyboardAwareScrollView` whose `bottomOffset` is the
 * footer's measured height, so a focused input always scrolls clear of footer +
 * keyboard. While the keyboard is up the secondary action collapses away.
 */
export function OnboardingShell({
  screen,
  onBack,
  title,
  subtitle,
  primary,
  secondary,
  footer,
  scroll = true,
  contentStyle,
  children,
  testID,
}: OnboardingShellProps) {
  const oc = useOnboardingColors();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const [footerHeight, setFooterHeight] = useState(0);
  const onFooterLayout = (event: LayoutChangeEvent) =>
    setFooterHeight(event.nativeEvent.layout.height);

  // With the keyboard up the footer's safe-area padding sits behind the
  // keyboard (the sticky view's `opened` offset), so only the rest is visible.
  const visibleFooter = Math.max(0, footerHeight - insets.bottom);
  const showSecondary = !!secondary && !keyboardVisible;

  const header =
    title || subtitle ? (
      <View style={{ gap: space.xs, marginBottom: space.xl }}>
        {title ? (
          <Text accessibilityRole="header" style={[type.largeTitle, { color: oc.textPrimary }]}>
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={[type.body, { color: oc.textSecondary }]}>{subtitle}</Text> : null}
      </View>
    ) : null;

  const contentPadding: ViewStyle = {
    paddingHorizontal: GUTTER,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  };

  const hasFooter = !!(primary || secondary || footer);

  return (
    <View style={{ flex: 1, backgroundColor: oc.background }} testID={testID}>
      <View style={{ paddingTop: insets.top }}>
        <OnboardingTopBar screen={screen} onBack={onBack} />
      </View>

      {scroll ? (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[contentPadding, contentStyle]}
          bottomOffset={visibleFooter + CARET_CLEARANCE}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {header}
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentPadding, contentStyle]}>
          {header}
          {children}
        </View>
      )}

      {hasFooter ? (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
          <View
            onLayout={onFooterLayout}
            style={{
              paddingHorizontal: GUTTER,
              paddingTop: space.sm,
              paddingBottom: insets.bottom + space.sm,
              gap: space.xxs,
              backgroundColor: oc.background,
            }}
          >
            {footer}
            {primary ? (
              <OnboardingContinueButton
                label={primary.label}
                onPress={primary.onPress}
                disabled={primary.disabled}
                showIcon={primary.showIcon}
                testID={primary.testID}
                accessibilityLabel={primary.accessibilityLabel}
              />
            ) : null}
            {showSecondary && secondary ? <OnboardingTextButton {...secondary} /> : null}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

/** Top bar: 44pt back control + the copper progress track. */
function OnboardingTopBar({ screen, onBack }: { screen?: OnboardingRoute; onBack?: () => void }) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  return (
    <View
      style={{
        height: TOP_BAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.xs,
      }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          android_ripple={{ color: oc.line, borderless: true, radius: 22 }}
          style={({ pressed }) => ({
            width: TOP_BAR_HEIGHT,
            height: TOP_BAR_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.5 : 1,
          })}
        >
          <ChevronLeft size={26} color={oc.textPrimary} />
        </Pressable>
      ) : (
        <View style={{ width: TOP_BAR_HEIGHT }} />
      )}
      <View style={{ flex: 1, paddingRight: space.md }}>
        {screen ? <ProgressTrack screen={screen} /> : null}
      </View>
    </View>
  );
}

function ProgressTrack({ screen }: { screen: OnboardingRoute }) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const { stepIndex, totalScreens } = useOnboardingStep(screen);
  const reduceMotion = useReducedMotion();
  const ratio = totalScreens > 0 && stepIndex >= 0 ? (stepIndex + 1) / totalScreens : 0;

  const fill = useSharedValue(ratio);
  useEffect(() => {
    fill.value = withTiming(ratio, { duration: reduceMotion ? 0 : TRACK_MS, easing: EASE_OUT });
  }, [fill, ratio, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  if (stepIndex < 0) return null;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.progressA11y', {
        step: stepIndex + 1,
        total: totalScreens,
      })}
      accessibilityValue={{ min: 0, max: totalScreens, now: stepIndex + 1 }}
      style={{
        height: TRACK_HEIGHT,
        borderRadius: radius.pill,
        backgroundColor: oc.surface3,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: oc.warm }, fillStyle]}
      />
    </View>
  );
}

/** Quiet text action (secondary) — 44pt tall, copper text. */
export function OnboardingTextButton({
  label,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
}: OnboardingAction) {
  const oc = useOnboardingColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 44,
        alignSelf: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.md,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={FOOTER_MAX_FONT_SCALE}
        style={[type.bodyStrong, { color: oc.warm2, textAlign: 'center' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
