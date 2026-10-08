import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link } from 'expo-router';

const logo = require('../../assets/images/motovault-logo.webp');

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  EMAIL_CODE_SOURCE,
  EMAIL_CODE_STEP_THEME,
  EmailCodeStep,
} from '../../components/auth/email-code-step';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { classifyAuthError, EMAIL_AUTH_ERROR, sendSignupCode } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const { t } = useTranslation();
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
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
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
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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

  const canSubmit = email.length > 0 && password.length > 0 && !loading;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceDark }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 48,
            gap: 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <Animated.View
            entering={FadeInDown.duration(600)}
            style={{ alignItems: 'center', gap: 12 }}
          >
            <Image
              source={logo}
              style={{
                width: 88,
                height: 88,
                borderRadius: 22,
                // @ts-expect-error borderCurve works on RN Image but isn't in ImageStyle types
                borderCurve: 'continuous',
                marginBottom: 8,
              }}
            />
            <Text
              style={{
                fontSize: 32,
                fontWeight: '800',
                color: palette.white,
                letterSpacing: -0.5,
                textAlign: 'center',
              }}
            >
              {t('common.appName')}
            </Text>
            <Text
              style={{
                fontSize: 17,
                color: palette.whiteAlpha50,
                textAlign: 'center',
              }}
            >
              {t('auth.tagline')}
            </Text>
          </Animated.View>

          {codeStep ? (
            <EmailCodeStep
              email={codeStep.email}
              source={EMAIL_CODE_SOURCE.SIGNIN_UNCONFIRMED}
              password={codeStep.password}
              initialCooldownMs={codeStep.initialCooldownMs}
              theme={EMAIL_CODE_STEP_THEME.auth}
              onBack={closeCodeStep}
              onBusyChange={onCodeStepBusyChange}
              onNeedsSignIn={closeCodeStep}
            />
          ) : (
            <>
              {/* Social auth */}
              <Animated.View entering={FadeInUp.delay(150).duration(500)} style={{ gap: 12 }}>
                {process.env.EXPO_OS === 'ios' && (
                  <Pressable
                    onPress={handleAppleSignIn}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: palette.white,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      paddingVertical: 16,
                      gap: 10,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: palette.black }}>
                      {t('auth.continueWithApple')}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleGoogleSignIn}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: palette.whiteAlpha08,
                    borderWidth: 1,
                    borderColor: palette.whiteAlpha12,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    paddingVertical: 16,
                    gap: 10,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: palette.white }}>G</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: palette.white }}>
                    {t('auth.continueWithGoogle')}
                  </Text>
                </Pressable>
              </Animated.View>

              {/* Divider */}
              <Animated.View
                entering={FadeIn.delay(300).duration(400)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: palette.whiteAlpha08 }} />
                <Text style={{ fontSize: 13, color: palette.whiteAlpha35, fontWeight: '500' }}>
                  {t('auth.orContinueWithEmail')}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: palette.whiteAlpha08 }} />
              </Animated.View>

              {/* Email form */}
              <Animated.View entering={FadeInUp.delay(350).duration(500)} style={{ gap: 14 }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.email')}
                  placeholderTextColor={palette.whiteAlpha30}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  style={{
                    backgroundColor: palette.whiteAlpha06,
                    borderWidth: 1,
                    borderColor: palette.whiteAlpha10,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                    fontSize: 16,
                    color: palette.white,
                  }}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.password')}
                  placeholderTextColor={palette.whiteAlpha30}
                  secureTextEntry
                  autoComplete="password"
                  style={{
                    backgroundColor: palette.whiteAlpha06,
                    borderWidth: 1,
                    borderColor: palette.whiteAlpha10,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                    fontSize: 16,
                    color: palette.white,
                  }}
                />
                <Pressable
                  onPress={handleLogin}
                  disabled={!canSubmit}
                  style={({ pressed }) => ({
                    backgroundColor: canSubmit ? palette.white : palette.whiteAlpha12,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    paddingVertical: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  {loading && <ActivityIndicator size="small" color={palette.surfaceDark} />}
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '700',
                      color: canSubmit ? palette.surfaceDark : palette.whiteAlpha30,
                    }}
                  >
                    {loading ? t('auth.signingIn') : t('auth.signIn')}
                  </Text>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <Animated.View
                entering={FadeIn.delay(500).duration(400)}
                style={{ alignItems: 'center' }}
              >
                <Link href="/(auth)/register" asChild>
                  <Pressable
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}
                  >
                    <Text
                      style={{ fontSize: 15, color: palette.moduleSuspension, fontWeight: '600' }}
                    >
                      {t('auth.noAccount')}
                    </Text>
                  </Pressable>
                </Link>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
