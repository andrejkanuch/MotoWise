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
import { tint } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { AppleGlyph, GoogleGlyph } from '../onboarding/oauth-glyphs';
import { useOnboardingColors } from '../onboarding/onboarding-colors';
import { authButton } from './auth-styles';

const FIELD_HEIGHT = 52;
const GLYPH_SIZE = 18;
const IS_IOS = process.env.EXPO_OS === 'ios';

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
}

/**
 * Platform-correct social sign-in: on iOS "Continue with Apple" leads, in the
 * scheme's ink (black on light, white on dark, per Apple's guidelines), with
 * Google second on a surface card; Android offers Google alone. 52pt each.
 */
export function OAuthButtons({ onApple, onGoogle }: OAuthButtonsProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  return (
    <View style={{ gap: space.sm }}>
      {IS_IOS ? (
        <Pressable
          onPress={onApple}
          accessibilityRole="button"
          style={({ pressed }) => [authButton(oc.textPrimary), { opacity: pressed ? 0.85 : 1 }]}
        >
          <AppleGlyph size={GLYPH_SIZE} color={oc.background} />
          <Text style={[type.bodyStrong, { color: oc.background }]}>
            {t('auth.continueWithApple')}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onGoogle}
        accessibilityRole="button"
        android_ripple={{ color: oc.line, foreground: true }}
        style={({ pressed }) => [
          authButton(oc.surface, oc.line),
          { overflow: 'hidden', opacity: pressed && IS_IOS ? 0.85 : 1 },
        ]}
      >
        <GoogleGlyph size={GLYPH_SIZE} />
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
