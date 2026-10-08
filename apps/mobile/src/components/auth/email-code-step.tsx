import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { EMAIL_OTP_LENGTH } from '../../config/auth';
import { useResendCooldown } from '../../hooks/use-resend-cooldown';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import {
  type ClassifiedAuthError,
  classifyAuthError,
  EMAIL_AUTH_ERROR,
  type EmailAuthErrorKind,
  normalizeEmail,
  sendSignupCode,
  verifySignupCode,
} from '../../lib/email-confirmation';
import { supabase } from '../../lib/supabase';
import { triggerNotification } from '../../utils/haptics';
import { ONBOARDING_COLORS } from '../onboarding/onboarding-colors';

/** Why a confirmation code was sent; the `source` of the `email_code_*` events. */
export const EMAIL_CODE_SOURCE = {
  SIGNUP: 'signup',
  SIGNIN_UNCONFIRMED: 'signin_unconfirmed',
  RESEND: 'resend',
} as const;

export type EmailCodeSource = (typeof EMAIL_CODE_SOURCE)[keyof typeof EMAIL_CODE_SOURCE];
/** The screens the code step is entered from. `resend` happens inside the step. */
export type EmailCodeEntrySource = Exclude<EmailCodeSource, typeof EMAIL_CODE_SOURCE.RESEND>;

export interface EmailCodeStepTheme {
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBackground: string;
  inputBorder: string;
  /** Text actions: Resend, "already confirmed", Change email. */
  accent: string;
  error: string;
}

/** Ready-made themes for the two places the step is shown. */
export const EMAIL_CODE_STEP_THEME = {
  onboarding: {
    textPrimary: ONBOARDING_COLORS.textPrimary,
    textSecondary: ONBOARDING_COLORS.textSecondary,
    textMuted: ONBOARDING_COLORS.textMuted,
    inputBackground: ONBOARDING_COLORS.cardBg,
    inputBorder: ONBOARDING_COLORS.cardBorderDefault,
    accent: ONBOARDING_COLORS.accent,
    error: ONBOARDING_COLORS.error,
  },
  auth: {
    textPrimary: palette.white,
    textSecondary: palette.whiteAlpha55,
    textMuted: palette.whiteAlpha35,
    inputBackground: palette.whiteAlpha06,
    inputBorder: palette.whiteAlpha10,
    accent: palette.moduleSuspension,
    error: palette.danger500,
  },
} as const satisfies Record<string, EmailCodeStepTheme>;

export interface EmailCodeStepProps {
  /** The address the code went to (already normalized by the caller or not; it is normalized here). */
  email: string;
  source: EmailCodeEntrySource;
  /** The password the rider just typed, held in memory only, for the already-confirmed recovery. */
  password?: string;
  /** Open with the resend countdown already running (a send was rate-limited). */
  initialCooldownMs?: number;
  theme: EmailCodeStepTheme;
  /** Back to the email form ("Change email"). */
  onBack: () => void;
  /** "Already confirmed" with no password in memory: take the rider to sign-in. */
  onNeedsSignIn: () => void;
  /** Reports whether a verify or recovery is in flight (e.g. to hold Android back). */
  onBusyChange?: (busy: boolean) => void;
}

const MESSAGE = {
  WRONG_OR_EXPIRED: 'auth.codeWrongOrExpired',
  TOO_MANY_ATTEMPTS: 'auth.codeTooManyAttempts',
  CONNECTION: 'auth.codeConnectionError',
  GENERIC: 'auth.codeGenericError',
  NOT_CONFIRMED_YET: 'auth.codeNotConfirmedYet',
  RESENT: 'auth.codeResent',
} as const;
type MessageKey = (typeof MESSAGE)[keyof typeof MESSAGE];

const TONE = { ERROR: 'error', INFO: 'info' } as const;
type Tone = (typeof TONE)[keyof typeof TONE];

interface StepMessage {
  key: MessageKey;
  tone: Tone;
}

/**
 * How long the field stays disabled after the verify endpoint throttles
 * (`over_request_rate_limit`). Supabase reports no retry-after for it.
 */
const VERIFY_THROTTLE_WAIT_MS = 60_000;
const NON_DIGITS = /\D/g;
const USER_SIGNED_UP_PROPS = { auth_method: 'email' } as const;

/** Copy for a failed send (Resend). `null` = no message (rate-limited shows the countdown). */
const SEND_ERROR_MESSAGE: Record<EmailAuthErrorKind, MessageKey | null> = {
  [EMAIL_AUTH_ERROR.RATE_LIMITED]: null,
  [EMAIL_AUTH_ERROR.THROTTLED]: MESSAGE.TOO_MANY_ATTEMPTS,
  [EMAIL_AUTH_ERROR.NETWORK]: MESSAGE.CONNECTION,
  [EMAIL_AUTH_ERROR.INVALID_OR_EXPIRED]: MESSAGE.GENERIC,
  [EMAIL_AUTH_ERROR.NOT_CONFIRMED]: MESSAGE.GENERIC,
  [EMAIL_AUTH_ERROR.GENERIC]: MESSAGE.GENERIC,
};

/** Copy for a failed "already confirmed" sign-in the rider asked for. */
const RECOVERY_ERROR_MESSAGE: Record<EmailAuthErrorKind, MessageKey> = {
  [EMAIL_AUTH_ERROR.NOT_CONFIRMED]: MESSAGE.NOT_CONFIRMED_YET,
  [EMAIL_AUTH_ERROR.NETWORK]: MESSAGE.CONNECTION,
  [EMAIL_AUTH_ERROR.THROTTLED]: MESSAGE.TOO_MANY_ATTEMPTS,
  [EMAIL_AUTH_ERROR.RATE_LIMITED]: MESSAGE.TOO_MANY_ATTEMPTS,
  [EMAIL_AUTH_ERROR.INVALID_OR_EXPIRED]: MESSAGE.GENERIC,
  [EMAIL_AUTH_ERROR.GENERIC]: MESSAGE.GENERIC,
};

/**
 * The emailed-code step of an email signup. Owns verify, resend and the
 * already-confirmed recovery; a successful verify or recovery only creates the
 * session — the app's existing auth listeners take it from there. Never signs
 * out or resets analytics identity, so pre-signup events stay attached.
 */
export function EmailCodeStep({
  email,
  source,
  password,
  initialCooldownMs,
  theme,
  onBack,
  onNeedsSignIn,
  onBusyChange,
}: EmailCodeStepProps) {
  const { t } = useTranslation();
  const address = normalizeEmail(email);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<StepMessage | null>(null);
  // The last verify was throttled: its kept digits can be retried once the wait is over.
  const [verifyThrottled, setVerifyThrottled] = useState(false);
  const resendCooldown = useResendCooldown(initialCooldownMs);
  const throttle = useResendCooldown();
  const inFlightRef = useRef(false);
  const autoRecoveryTriedRef = useRef(false);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // The throttled message describes the wait; drop it once the wait is over.
  useEffect(() => {
    if (!throttle.isCoolingDown) {
      setMessage((current) => (current?.key === MESSAGE.TOO_MANY_ATTEMPTS ? null : current));
    }
  }, [throttle.isCoolingDown]);

  const show = (key: MessageKey, tone: Tone = TONE.ERROR) => {
    setMessage({ key, tone });
    AccessibilityInfo.announceForAccessibility(t(key));
    if (tone === TONE.ERROR) triggerNotification(Haptics.NotificationFeedbackType.Error);
  };

  const signedUp = (
    event: typeof AnalyticsEvent.EMAIL_CODE_VERIFIED | typeof AnalyticsEvent.EMAIL_CODE_RECOVERED,
  ) => {
    triggerNotification(Haptics.NotificationFeedbackType.Success);
    trackEvent(event, { source });
    trackEvent(AnalyticsEvent.USER_SIGNED_UP, USER_SIGNED_UP_PROPS);
  };

  /** Sign in with the in-memory password: succeeds only if the email was confirmed elsewhere. */
  const recover = async (pw: string): Promise<ClassifiedAuthError | null> => {
    let error: unknown;
    try {
      ({ error } = await supabase.auth.signInWithPassword({ email: address, password: pw }));
    } catch (thrown) {
      error = thrown;
    }
    if (!error) {
      signedUp(AnalyticsEvent.EMAIL_CODE_RECOVERED);
      return null;
    }
    return classifyAuthError(error);
  };

  const handleVerifyFailure = async (failure: ClassifiedAuthError) => {
    trackEvent(AnalyticsEvent.EMAIL_CODE_FAILED, { source, reason: failure.kind });
    switch (failure.kind) {
      case EMAIL_AUTH_ERROR.INVALID_OR_EXPIRED: {
        setCode('');
        show(MESSAGE.WRONG_OR_EXPIRED);
        // The code may have been consumed by the fallback link. Try once.
        if (password && !autoRecoveryTriedRef.current) {
          autoRecoveryTriedRef.current = true;
          return (await recover(password)) === null;
        }
        return false;
      }
      case EMAIL_AUTH_ERROR.THROTTLED:
      case EMAIL_AUTH_ERROR.RATE_LIMITED:
        throttle.start(VERIFY_THROTTLE_WAIT_MS);
        setVerifyThrottled(true);
        show(MESSAGE.TOO_MANY_ATTEMPTS);
        return false;
      case EMAIL_AUTH_ERROR.NETWORK:
        show(MESSAGE.CONNECTION);
        return false;
      default:
        show(MESSAGE.GENERIC);
        return false;
    }
  };

  const verify = async (digits: string) => {
    inFlightRef.current = true;
    setBusy(true);
    setMessage(null);
    setVerifyThrottled(false);
    let error: unknown;
    try {
      ({ error } = await verifySignupCode(address, digits));
    } catch (thrown) {
      error = thrown;
    }
    // Once signed in, the step stays busy until the session swaps the screen.
    if (!error) {
      signedUp(AnalyticsEvent.EMAIL_CODE_VERIFIED);
      return;
    }
    const recovered = await handleVerifyFailure(classifyAuthError(error));
    if (!recovered) {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const handleChangeText = (text: string) => {
    if (inFlightRef.current) return;
    const digits = text.replace(NON_DIGITS, '').slice(0, EMAIL_OTP_LENGTH);
    setCode(digits);
    if (digits.length === EMAIL_OTP_LENGTH) void verify(digits);
  };

  const handleResend = async () => {
    setSending(true);
    setMessage(null);
    let error: unknown;
    try {
      ({ error } = await sendSignupCode(address));
    } catch (thrown) {
      error = thrown;
    }
    setSending(false);
    if (!error) {
      resendCooldown.start();
      trackEvent(AnalyticsEvent.EMAIL_CODE_SENT, { source: EMAIL_CODE_SOURCE.RESEND });
      show(MESSAGE.RESENT, TONE.INFO);
      return;
    }
    const failure = classifyAuthError(error);
    if (failure.kind === EMAIL_AUTH_ERROR.RATE_LIMITED) {
      resendCooldown.start(failure.retryAfterMs);
      return;
    }
    const key = SEND_ERROR_MESSAGE[failure.kind];
    if (key) show(key);
  };

  const handleAlreadyConfirmed = async () => {
    if (!password) {
      onNeedsSignIn();
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setMessage(null);
    const failure = await recover(password);
    if (failure) {
      show(RECOVERY_ERROR_MESSAGE[failure.kind]);
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const fieldDisabled = busy || throttle.isCoolingDown;
  // A failed verify that keeps the digits (connection, unknown error, or a throttle
  // whose wait is over — `fieldDisabled` covers the wait) can be retried as-is; a
  // wrong code clears the field instead.
  const canRetry =
    !fieldDisabled &&
    code.length === EMAIL_OTP_LENGTH &&
    (verifyThrottled || message?.key === MESSAGE.CONNECTION || message?.key === MESSAGE.GENERIC);
  const resendDisabled = busy || sending || resendCooldown.isCoolingDown;
  const resendLabel = resendCooldown.isCoolingDown
    ? t('auth.codeResendIn', { seconds: resendCooldown.remainingSeconds })
    : t('auth.codeResend');

  return (
    <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 26, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.4 }}
        >
          {t('auth.codeTitle')}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 21, color: theme.textSecondary }}>
          {t('auth.codeSentTo', { digits: EMAIL_OTP_LENGTH, email: address })}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {/* No native maxLength: it truncates a paste BEFORE onChangeText, so
            "Your code: 482 913" would lose its digits. Length is enforced in handleChangeText. */}
        <TextInput
          value={code}
          onChangeText={handleChangeText}
          editable={!fieldDisabled}
          accessibilityLabel={t('auth.codeInputLabel')}
          accessibilityState={{ disabled: fieldDisabled, busy }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          selectionColor={theme.accent}
          style={{
            backgroundColor: theme.inputBackground,
            borderWidth: 1,
            borderColor: message?.tone === TONE.ERROR ? theme.error : theme.inputBorder,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingHorizontal: 16,
            paddingVertical: 16,
            fontFamily: 'GeistMono-Medium',
            fontSize: 28,
            letterSpacing: 10,
            textAlign: 'center',
            color: theme.textPrimary,
            opacity: fieldDisabled && !busy ? 0.5 : 1,
          }}
        />
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={theme.textSecondary} />
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>
              {t('auth.codeVerifying')}
            </Text>
          </View>
        ) : null}
        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: message.tone === TONE.ERROR ? theme.error : theme.textSecondary,
            }}
          >
            {t(message.key)}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 4, alignItems: 'flex-start' }}>
        {canRetry ? (
          <TextAction
            label={t('common.tryAgain')}
            onPress={() => void verify(code)}
            color={theme.accent}
            disabledColor={theme.textMuted}
          />
        ) : null}
        <TextAction
          label={resendLabel}
          onPress={handleResend}
          disabled={resendDisabled}
          color={theme.accent}
          disabledColor={theme.textMuted}
        />
        <TextAction
          label={t('auth.codeAlreadyConfirmed')}
          onPress={handleAlreadyConfirmed}
          disabled={busy}
          color={theme.accent}
          disabledColor={theme.textMuted}
        />
        {busy ? null : (
          <TextAction
            label={t('auth.codeChangeEmail')}
            onPress={onBack}
            color={theme.textSecondary}
            disabledColor={theme.textMuted}
          />
        )}
      </View>
    </Animated.View>
  );
}

interface TextActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color: string;
  disabledColor: string;
}

function TextAction({ label, onPress, disabled = false, color, disabledColor }: TextActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => ({
        paddingVertical: 8,
        borderRadius: 8,
        borderCurve: 'continuous',
        opacity: pressed && !disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: disabled ? disabledColor : color }}>
        {label}
      </Text>
    </Pressable>
  );
}
