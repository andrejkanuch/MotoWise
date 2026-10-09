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
import { authButton, authInput, authInputColors } from '../../components/auth/auth-styles';
import { EMAIL_CODE_SOURCE, EmailCodeStep } from '../../components/auth/email-code-step';
import { AppleGlyph, GoogleGlyph } from '../../components/onboarding/oauth-glyphs';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { classifyAuthError, EMAIL_AUTH_ERROR, sendSignupCode } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { supabase } from '../../lib/supabase';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';

export default function LoginScreen() {
  const oc = useOnboardingColors();
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
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: space.xl,
            paddingVertical: space.xxxl,
            gap: space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={{ alignItems: 'center', gap: space.xs }}
          >
            <Image
              source={logo}
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.plate,
                // @ts-expect-error borderCurve works on RN Image but isn't in ImageStyle types
                borderCurve: 'continuous',
                marginBottom: space.xs,
              }}
            />
            <Text
              accessibilityRole="header"
              style={[type.largeTitle, { color: oc.textPrimary, textAlign: 'center' }]}
            >
              {t('common.appName')}
            </Text>
            <Text style={[type.body, { color: oc.textSecondary, textAlign: 'center' }]}>
              {t('auth.tagline')}
            </Text>
          </Animated.View>

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
            <>
              {/* Social auth */}
              <Animated.View entering={FadeInUp.delay(100).duration(280)} style={{ gap: space.sm }}>
                {process.env.EXPO_OS === 'ios' && (
                  <Pressable
                    onPress={handleAppleSignIn}
                    style={({ pressed }) => [
                      authButton(oc.textPrimary),
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <AppleGlyph size={18} color={oc.background} />
                    <Text style={[type.bodyStrong, { color: oc.background }]}>
                      {t('auth.continueWithApple')}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleGoogleSignIn}
                  android_ripple={{ color: oc.borderMuted }}
                  style={({ pressed }) => [
                    authButton(oc.surface2),
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <GoogleGlyph size={18} />
                  <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                    {t('auth.continueWithGoogle')}
                  </Text>
                </Pressable>
              </Animated.View>

              {/* Divider */}
              <Animated.View
                entering={FadeIn.delay(160).duration(240)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: oc.line }} />
                <Text style={[type.caption, { color: oc.textMuted }]}>
                  {t('auth.orContinueWithEmail')}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: oc.line }} />
              </Animated.View>

              {/* Email form */}
              <Animated.View entering={FadeInUp.delay(200).duration(280)} style={{ gap: space.sm }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.email')}
                  placeholderTextColor={oc.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  style={[authInput, authInputColors(oc)]}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.password')}
                  placeholderTextColor={oc.textMuted}
                  secureTextEntry
                  autoComplete="password"
                  style={[authInput, authInputColors(oc)]}
                />
                <Pressable
                  onPress={handleLogin}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    authButton(canSubmit ? oc.warm : oc.surface2),
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {loading && <ActivityIndicator size="small" color={oc.textOnAccent} />}
                  <Text
                    style={[
                      type.bodyStrong,
                      {
                        color: canSubmit ? oc.textOnAccent : oc.textMuted,
                      },
                    ]}
                  >
                    {loading ? t('auth.signingIn') : t('auth.signIn')}
                  </Text>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <Animated.View
                entering={FadeIn.delay(260).duration(240)}
                style={{ alignItems: 'center' }}
              >
                <Link href="/(auth)/register" asChild>
                  <Pressable
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.6 : 1,
                      minHeight: 44,
                      justifyContent: 'center',
                    })}
                  >
                    <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: oc.warm2 }]}>
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
