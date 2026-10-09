import * as Haptics from 'expo-haptics';
import { type Href, useRouter } from 'expo-router';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AuthDivider, AuthField, OAuthButtons } from '../../components/auth/auth-field';
import { EMAIL_CODE_SOURCE, EmailCodeStep } from '../../components/auth/email-code-step';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { AUTH_EMAIL_REDIRECT_TO } from '../../config/auth';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { signUpConsentMetadata } from '../../lib/analytics-consent';
import { classifyAuthError, EMAIL_AUTH_ERROR, normalizeEmail } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { supabase } from '../../lib/supabase';
import { space } from '../../theme/type';

const LOGIN_ROUTE: Href = '/(auth)/login';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  // Back from the code step returns to this form: the email stays, the password
  // is cleared. Android hardware back does the same instead of leaving the screen.
  const {
    codeStep,
    open: openCodeStep,
    openRateLimited: openCodeStepRateLimited,
    close: closeCodeStep,
    onBusyChange: onCodeStepBusyChange,
  } = useEmailCodeStep({ clearPassword: () => setPassword('') });

  const handleRegister = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLoading(true);
    // The code step verifies against the normalized address; sign up with the same one.
    const address = normalizeEmail(email);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: {
          data: { full_name: fullName, ...signUpConsentMetadata() },
          emailRedirectTo: AUTH_EMAIL_REDIRECT_TO,
        },
      });
      if (error) {
        const failure = classifyAuthError(error);
        // The confirmation email could not be sent yet: open the code step with
        // the wait already running, so the rider can resend once it is over.
        if (failure.kind === EMAIL_AUTH_ERROR.RATE_LIMITED) {
          openCodeStepRateLimited(address, password, failure.retryAfterMs);
        } else {
          Alert.alert(t('common.error'), userFriendlyError(error));
        }
      } else if (data.user && !data.session) {
        // An empty `identities` array is Supabase's signal that this email is
        // ALREADY registered: it suppresses the email (enumeration protection),
        // so a code step would wait for a code that never comes. Offer sign-in.
        if (data.user.identities?.length === 0) {
          Alert.alert(t('auth.accountExistsTitle'), t('auth.accountExistsMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.signIn'), onPress: () => router.replace(LOGIN_ROUTE) },
          ]);
        } else {
          // USER_SIGNED_UP fires from the code step once the account is confirmed.
          trackEvent(AnalyticsEvent.EMAIL_CODE_SENT, { source: EMAIL_CODE_SOURCE.SIGNUP });
          openCodeStep({ email: address, password });
        }
      } else if (data.user && data.session) {
        trackEvent(AnalyticsEvent.USER_SIGNED_UP, { auth_method: 'email' });
      }
    } catch (err) {
      captureException(err);
      Alert.alert(t('common.error'), userFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const { isNewUser } = await signInWithApple();
      // Attribute from the auth result, not the screen — a returning user may tap OAuth here.
      trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
        auth_method: 'apple',
      });
    } catch (err) {
      // Cancellations and Apple's generic "unknown reason" failure are expected
      // user outcomes, not bugs — don't report them to Sentry. (MOTO-VAULT-REACT-NATIVE-C)
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleGoogleSignIn = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const { isNewUser } = await signInWithGoogle();
      trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
        auth_method: 'google',
      });
    } catch (err) {
      presentOAuthError(err);
    }
  };

  const canSubmit = email.length > 0 && password.length > 0 && fullName.length > 0 && !loading;

  return (
    <OnboardingShell
      title={codeStep ? undefined : t('auth.signUp')}
      primary={
        codeStep
          ? undefined
          : {
              label: loading ? t('auth.signingUp') : t('auth.signUp'),
              onPress: handleRegister,
              disabled: !canSubmit,
            }
      }
      secondary={
        codeStep
          ? undefined
          : { label: t('auth.hasAccount'), onPress: () => router.push(LOGIN_ROUTE) }
      }
    >
      {codeStep ? (
        <EmailCodeStep
          email={codeStep.email}
          source={EMAIL_CODE_SOURCE.SIGNUP}
          password={codeStep.password}
          initialCooldownMs={codeStep.initialCooldownMs}
          onBack={closeCodeStep}
          onBusyChange={onCodeStepBusyChange}
          onNeedsSignIn={() => router.replace(LOGIN_ROUTE)}
        />
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.sm }}>
          <OAuthButtons onApple={handleAppleSignIn} onGoogle={handleGoogleSignIn} />
          <AuthDivider label={t('auth.orContinueWithEmail')} />
          <View style={{ gap: space.md }}>
            <AuthField
              label={t('auth.fullName')}
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              textContentType="name"
            />
            <AuthField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <AuthField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>
        </Animated.View>
      )}
    </OnboardingShell>
  );
}
