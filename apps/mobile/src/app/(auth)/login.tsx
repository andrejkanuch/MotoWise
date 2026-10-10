import * as Haptics from 'expo-haptics';
import { type Href, useRouter } from 'expo-router';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AuthDivider, AuthField, OAuthButtons } from '../../components/auth/auth-field';
import { EMAIL_CODE_SOURCE, EmailCodeStep } from '../../components/auth/email-code-step';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { classifyAuthError, EMAIL_AUTH_ERROR, sendSignupCode } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { supabase } from '../../lib/supabase';
import { space } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

const REGISTER_ROUTE: Href = '/(auth)/register';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  // The account exists but was never confirmed: send a fresh code and open the
  // code step. A failed send keeps the rider on this form.
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
    Alert.alert(t('common.error'), t('auth.codeSendFailed'));
  };

  const handleLogin = async () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        trackEvent(AnalyticsEvent.USER_SIGNED_IN, { auth_method: 'email' });
      } else if (classifyAuthError(error).kind === EMAIL_AUTH_ERROR.NOT_CONFIRMED) {
        await openCodeStepForUnconfirmed();
      } else {
        Alert.alert(t('common.error'), userFriendlyError(error));
      }
    } catch (err) {
      captureException(err);
      Alert.alert(t('common.error'), userFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { isNewUser } = await signInWithApple();
      // OAuth can't tell signup from sign-in by screen — attribute from the auth result.
      trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
        auth_method: 'apple',
      });
    } catch (err) {
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleGoogleSignIn = async () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { isNewUser } = await signInWithGoogle();
      trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
        auth_method: 'google',
      });
    } catch (err) {
      presentOAuthError(err);
    }
  };

  const canSubmit = email.length > 0 && password.length > 0 && !loading;

  return (
    <OnboardingShell
      title={codeStep ? undefined : t('common.appName')}
      subtitle={codeStep ? undefined : t('auth.tagline')}
      primary={
        codeStep
          ? undefined
          : {
              label: loading ? t('auth.signingIn') : t('auth.signIn'),
              onPress: handleLogin,
              disabled: !canSubmit,
            }
      }
      secondary={
        codeStep
          ? undefined
          : { label: t('auth.noAccount'), onPress: () => router.push(REGISTER_ROUTE) }
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
          <OAuthButtons onApple={handleAppleSignIn} onGoogle={handleGoogleSignIn} />
          <AuthDivider label={t('auth.orContinueWithEmail')} />
          <View style={{ gap: space.md }}>
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
              autoComplete="password"
              textContentType="password"
            />
          </View>
        </Animated.View>
      )}
    </OnboardingShell>
  );
}
