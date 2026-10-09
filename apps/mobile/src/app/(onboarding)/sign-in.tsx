import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  AuthBusyOverlay,
  AuthDivider,
  AuthField,
  OAuthButtons,
} from '../../components/auth/auth-field';
import { EMAIL_CODE_SOURCE, EmailCodeStep } from '../../components/auth/email-code-step';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_ROUTE } from '../../config/onboarding';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { classifyAuthError, EMAIL_AUTH_ERROR, sendSignupCode } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import { supabase } from '../../lib/supabase';
import { SYSTEM_WEIGHT, space, type } from '../../theme/type';

/**
 * Returning-user sign-in, reachable from Welcome's "Log in" and the account
 * step's "Already have an account?". Lives inside (onboarding) so it is
 * available during anonymous onboarding (the (auth) group is hidden then).
 * On success, onAuthStateChange in _layout sets the session + calls
 * loginRevenueCat/identifyUser, and the root gate routes the user onward
 * (to tabs if their onboarding is already complete server-side).
 */
export default function OnboardingSignInScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  // Back from the code step returns to this form: the email stays, the password
  // is cleared. Android hardware back does the same instead of leaving sign-in.
  const {
    codeStep,
    open: openCodeStep,
    openRateLimited: openCodeStepRateLimited,
    close: closeCodeStep,
    back: backFromCodeStep,
    onBusyChange: onCodeStepBusyChange,
  } = useEmailCodeStep({ clearPassword: () => setPassword('') });

  // The account exists but was never confirmed: send a fresh code and open the
  // code step. A failed send keeps the rider on this form — never "no account found".
  const openCodeStepForUnconfirmed = async () => {
    let error: unknown;
    try {
      ({ error } = await sendSignupCode(email));
    } catch (thrown) {
      error = thrown;
    }
    if (!error) {
      trackEvent(AnalyticsEvent.EMAIL_CODE_SENT, { source: EMAIL_CODE_SOURCE.SIGNIN_UNCONFIRMED });
      openCodeStep({ email, password });
      return;
    }
    const failure = classifyAuthError(error);
    if (failure.kind === EMAIL_AUTH_ERROR.RATE_LIMITED) {
      openCodeStepRateLimited(email, password, failure.retryAfterMs);
      return;
    }
    setSendFailed(true);
  };

  // New/unrecognized users start the onboarding flow (account creation is its
  // final step). Replace so the back stack matches the welcome-initiated path
  // (welcome → experience), and fire ONBOARDING_STARTED to keep the funnel
  // intact for riders who begin from sign-in rather than the welcome CTA.
  const goToGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_STARTED, {});
    router.replace(OB_ROUTE.EXPERIENCE);
  };

  const handleApple = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { isNewUser } = await signInWithApple();
      trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
        auth_method: 'apple',
      });
    } catch (err) {
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleGoogle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { isNewUser } = await signInWithGoogle();
      trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
        auth_method: 'google',
      });
    } catch (err) {
      presentOAuthError(err);
    }
  };

  const handleEmail = async () => {
    setBusy(true);
    setNotFound(false);
    setSendFailed(false);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      // Classified first: an unconfirmed account is also a 400, and must reach
      // the code step instead of the not-found branch below.
      if (error && classifyAuthError(error).kind === EMAIL_AUTH_ERROR.NOT_CONFIRMED) {
        await openCodeStepForUnconfirmed();
      } else if (error) {
        // Invalid credentials → surface inline ("no account found"); keep the
        // alert path for genuinely unexpected errors only.
        if (error.status === 400 || /invalid login/i.test(error.message)) {
          setNotFound(true);
        } else {
          Alert.alert(t('common.error'), userFriendlyError(error));
        }
      } else {
        trackEvent(AnalyticsEvent.USER_SIGNED_IN, { auth_method: 'email' });
      }
    } catch (err) {
      captureException(err);
      Alert.alert(t('common.error'), userFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.length > 0 && password.length > 0 && !busy;

  return (
    <View style={{ flex: 1 }}>
      <OnboardingShell
        onBack={codeStep ? backFromCodeStep : () => router.back()}
        // EmailCodeStep has its own header; the screen's heading steps aside.
        title={codeStep ? undefined : t('onboarding.obSignInTitle' as never)}
        subtitle={codeStep ? undefined : t('onboarding.obSignInSubtitle')}
        primary={
          codeStep
            ? undefined
            : { label: t('auth.signIn'), onPress: handleEmail, disabled: !canSubmit }
        }
        secondary={
          codeStep
            ? undefined
            : {
                label: `${t('onboarding.obSignInNewHere' as never)} ${t('onboarding.obSignInGetStarted' as never)}`,
                onPress: goToGetStarted,
              }
        }
      >
        {codeStep ? (
          <EmailCodeStep
            email={codeStep.email}
            source={EMAIL_CODE_SOURCE.SIGNIN_UNCONFIRMED}
            password={codeStep.password}
            initialCooldownMs={codeStep.initialCooldownMs}
            onBack={closeCodeStep}
            onBusyChange={onCodeStepBusyChange}
            onNeedsSignIn={closeCodeStep}
          />
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.sm }}>
            <OAuthButtons onApple={handleApple} onGoogle={handleGoogle} />
            <AuthDivider label={t('onboarding.obAccountOrEmail')} />
            <View style={{ gap: space.md }}>
              <AuthField
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                invalid={notFound}
              />
              <AuthField
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                invalid={notFound}
              />
            </View>
            {sendFailed ? (
              <Text accessibilityLiveRegion="polite" style={[type.subhead, { color: oc.error }]}>
                {t('auth.codeSendFailed')}
              </Text>
            ) : null}
            {notFound ? (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: space.xxs,
                }}
              >
                <Text style={[type.subhead, { color: oc.error }]}>
                  {t('onboarding.obSignInNotFound' as never)}
                </Text>
                <Pressable
                  onPress={goToGetStarted}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: oc.warm2 }]}>
                    {t('onboarding.obSignInCreateOne' as never)}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        )}
      </OnboardingShell>

      {busy ? <AuthBusyOverlay label={t('onboarding.obSignInSigningIn' as never)} /> : null}
    </View>
  );
}
