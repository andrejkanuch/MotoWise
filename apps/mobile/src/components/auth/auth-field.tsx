import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { AUTH_METHOD, type AuthMethod } from '../../config/auth';
import { tint } from '../../theme/editorial';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { AppleGlyph, GoogleGlyph } from '../onboarding/oauth-glyphs';
import { useOnboardingColors } from '../onboarding/onboarding-colors';
import { authButton } from './auth-styles';

const FIELD_HEIGHT = 52;
const GLYPH_SIZE = 18;
const IS_IOS = process.env.EXPO_OS === 'ios';
/** The provider button not being waited on, while the other one is. */
const IDLE_WHILE_BUSY_OPACITY = 0.5;

interface AuthFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  /** System label above the field; also the input's accessibility label. */
  label: string;
  /** Draws the field's hairline in the error colour. */
  invalid?: boolean;
  /** On a surface (a sheet): the field card steps up to surface2. */
  raised?: boolean;
}

/**
 * An auth form field, styled like the app's sheets: a system label above a
 * 52pt surface field card with a hairline. Tapping the label focuses the input.
 */
export function AuthField({
  label,
  invalid = false,
  raised = false,
  ...inputProps
}: AuthFieldProps) {
  const oc = useOnboardingColors();
  const inputRef = useRef<TextInput>(null);
  return (
    <View style={{ gap: space.xxs }}>
      <Pressable onPress={() => inputRef.current?.focus()} hitSlop={4}>
        <Text style={[type.label, { color: oc.textSecondary }]}>{label}</Text>
      </Pressable>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={oc.textMuted}
        selectionColor={oc.warm}
        style={[
          type.body,
          {
            minHeight: FIELD_HEIGHT,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: raised ? oc.surface2 : oc.surface,
            borderWidth: 1,
            borderColor: invalid ? oc.error : oc.line,
            color: oc.textPrimary,
          },
        ]}
        {...inputProps}
      />
    </View>
  );
}

interface OAuthButtonsProps {
  onApple: () => void;
  onGoogle: () => void;
  /**
   * The provider whose sign-in is pending (`useOAuthSignIn().busyProvider`): both
   * buttons are disabled, the pending one shows a spinner in place of its glyph.
   */
  busyProvider?: AuthMethod | null;
}

/**
 * Platform-correct social sign-in: on iOS "Continue with Apple" leads, in the
 * scheme's ink (black on light, white on dark, per Apple's guidelines), with
 * Google second on a surface card; Android offers Google alone. 52pt each.
 */
export function OAuthButtons({ onApple, onGoogle, busyProvider = null }: OAuthButtonsProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const disabled = busyProvider !== null;
  const appleBusy = busyProvider === AUTH_METHOD.APPLE;
  const googleBusy = busyProvider === AUTH_METHOD.GOOGLE;
  const restingOpacity = (busy: boolean) => (disabled && !busy ? IDLE_WHILE_BUSY_OPACITY : 1);
  return (
    <View style={{ gap: space.sm }}>
      {IS_IOS ? (
        <Pressable
          onPress={onApple}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: appleBusy }}
          style={({ pressed }) => [
            authButton(oc.textPrimary),
            { opacity: pressed ? 0.85 : restingOpacity(appleBusy) },
          ]}
        >
          {appleBusy ? (
            <ActivityIndicator size="small" color={oc.background} />
          ) : (
            <AppleGlyph size={GLYPH_SIZE} color={oc.background} />
          )}
          <Text style={[type.bodyStrong, { color: oc.background }]}>
            {t('auth.continueWithApple')}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onGoogle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: googleBusy }}
        android_ripple={{ color: oc.line, foreground: true }}
        style={({ pressed }) => [
          authButton(oc.surface, oc.line),
          {
            overflow: 'hidden',
            opacity: pressed && IS_IOS ? 0.85 : restingOpacity(googleBusy),
          },
        ]}
      >
        {googleBusy ? (
          <ActivityIndicator size="small" color={oc.textPrimary} />
        ) : (
          <GoogleGlyph size={GLYPH_SIZE} />
        )}
        <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
          {t('auth.continueWithGoogle')}
        </Text>
      </Pressable>
    </View>
  );
}

/** "or" rule between social sign-in and email. */
export function AuthDivider({ label }: { label: string }) {
  const oc = useOnboardingColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        marginVertical: space.xs,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: oc.line }} />
      <Text style={[type.caption, { color: oc.textMuted }]}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: oc.line }} />
    </View>
  );
}

/** Full-screen blocking state while an auth call is in flight. */
export function AuthBusyOverlay({ label }: { label: string }) {
  const oc = useOnboardingColors();
  return (
    <View
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: tint(oc.background, 0.9),
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
      }}
    >
      <ActivityIndicator size="large" color={oc.warm} />
      <Text style={[type.subhead, { color: oc.textSecondary }]}>{label}</Text>
    </View>
  );
}
