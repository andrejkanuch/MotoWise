import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';

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
import { AUTH_EMAIL_REDIRECT_TO } from '../../config/auth';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { signUpConsentMetadata } from '../../lib/analytics-consent';
import { classifyAuthError, EMAIL_AUTH_ERROR, normalizeEmail } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { supabase } from '../../lib/supabase';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';

export default function RegisterScreen() {
  const oc = useOnboardingColors();
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
            { text: t('auth.signIn'), onPress: () => router.replace('/(auth)/login') },
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
              {t('auth.signUp')}
            </Text>
          </Animated.View>

          {codeStep ? (
            <EmailCodeStep
              email={codeStep.email}
              source={EMAIL_CODE_SOURCE.SIGNUP}
              password={codeStep.password}
              initialCooldownMs={codeStep.initialCooldownMs}
              onBack={closeCodeStep}
              onBusyChange={onCodeStepBusyChange}
              onNeedsSignIn={() => router.replace('/(auth)/login')}
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
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('auth.fullName')}
                  placeholderTextColor={oc.textMuted}
                  autoComplete="name"
                  style={[authInput, authInputColors(oc)]}
                />
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
                  autoComplete="new-password"
                  style={[authInput, authInputColors(oc)]}
                />
                <Pressable
                  onPress={handleRegister}
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
                    {loading ? t('auth.signingUp') : t('auth.signUp')}
                  </Text>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <Animated.View
                entering={FadeIn.delay(260).duration(240)}
                style={{ alignItems: 'center' }}
              >
                <Link href="/(auth)/login" asChild>
                  <Pressable
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.6 : 1,
                      minHeight: 44,
                      justifyContent: 'center',
                    })}
                  >
                    <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: oc.warm2 }]}>
                      {t('auth.hasAccount')}
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
