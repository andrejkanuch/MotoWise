import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppleGlyph, GoogleGlyph } from '../../components/onboarding/oauth-glyphs';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OB_ROUTE } from '../../config/onboarding';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import { restorePurchases } from '../../lib/subscription';
import { supabase } from '../../lib/supabase';

/**
 * Returning-user sign-in, reachable from Welcome's "Log in" and the account
 * step's "Already have an account?". Lives inside (onboarding) so it is
 * available during anonymous onboarding (the (auth) group is hidden then).
 * On success, onAuthStateChange in _layout sets the session + calls
 * loginRevenueCat/identifyUser, and the root gate routes the user onward
 * (to tabs if their onboarding is already complete server-side).
 */
export default function OnboardingSignInScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // New/unrecognized users start the onboarding flow (account creation is its
  // final step). Replace so the back stack matches the welcome-initiated path
  // (welcome → experience), and fire ONBOARDING_STARTED to keep the funnel
  // intact for riders who begin from sign-in rather than the welcome CTA.
  const goToGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_STARTED, {});
    router.replace(OB_ROUTE.EXPERIENCE);
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const isPro = await restorePurchases();
      Alert.alert(
        t('onboarding.obSignInRestore' as never),
        isPro
          ? t('onboarding.obSignInRestoreFound' as never)
          : t('onboarding.obSignInRestoreNone' as never),
      );
    } finally {
      setBusy(false);
    }
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
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleEmail = async () => {
    setBusy(true);
    setNotFound(false);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
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
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingBackButton
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 10 }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 26,
            paddingVertical: 48,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.duration(320)}
            style={{
              width: 52,
              height: 52,
              borderRadius: 15,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.warm,
              overflow: 'hidden',
              marginBottom: 22,
            }}
          >
            <Image
              source={require('../../assets/images/motovault-logo.webp')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(40).duration(320)}
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 36,
              lineHeight: 38,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
              marginBottom: 8,
            }}
          >
            {t('onboarding.obSignInTitleLead' as never)}
            {'\n'}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.obSignInTitleAccent' as never)}
            </Text>
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.delay(60).duration(320)}
            style={{
              fontSize: 14.5,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 21,
              marginBottom: 28,
            }}
          >
            {t('onboarding.obSignInSubtitle')}
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(120).duration(320)} style={{ gap: 11 }}>
            {process.env.EXPO_OS === 'ios' ? (
              <Pressable onPress={handleApple} style={authButton(ONBOARDING_COLORS.textWhite)}>
                <AppleGlyph size={18} color={ONBOARDING_COLORS.background} />
                <Text
                  style={{ fontSize: 15.5, fontWeight: '600', color: ONBOARDING_COLORS.background }}
                >
                  {t('auth.continueWithApple')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleGoogle}
              style={authButton(ONBOARDING_COLORS.cardBg, ONBOARDING_COLORS.cardBorderDefault)}
            >
              <GoogleGlyph size={18} />
              <Text
                style={{ fontSize: 15.5, fontWeight: '600', color: ONBOARDING_COLORS.textPrimary }}
              >
                {t('auth.continueWithGoogle')}
              </Text>
            </Pressable>

            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: ONBOARDING_COLORS.line }} />
              <Text
                style={{
                  fontFamily: 'GeistMono-Medium',
                  fontSize: 10,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: ONBOARDING_COLORS.textMuted,
                }}
              >
                {t('onboarding.obAccountOrEmail')}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: ONBOARDING_COLORS.line }} />
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.email')}
              placeholderTextColor={ONBOARDING_COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={authInput}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={ONBOARDING_COLORS.textMuted}
              secureTextEntry
              autoComplete="password"
              style={authInput}
            />
            {notFound ? (
              <Animated.View
                entering={FadeInUp.duration(220)}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 2,
                }}
              >
                <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.error }}>
                  {t('onboarding.obSignInNotFound' as never)}
                </Text>
                <Pressable onPress={goToGetStarted} hitSlop={8}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: ONBOARDING_COLORS.warm2 }}>
                    {t('onboarding.obSignInCreateOne' as never)}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}
            <OnboardingContinueButton
              label={t('auth.signIn')}
              onPress={handleEmail}
              disabled={!canSubmit}
              showIcon={false}
            />

            <Pressable
              onPress={goToGetStarted}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 10 }}
            >
              <Text style={{ fontSize: 13.5, color: ONBOARDING_COLORS.textSecondary }}>
                {t('onboarding.obSignInNewHere' as never)}{' '}
                <Text style={{ color: ONBOARDING_COLORS.warm2, fontWeight: '600' }}>
                  {t('onboarding.obSignInGetStarted' as never)}
                </Text>
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRestore}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 14 }}
            >
              <Text style={{ fontSize: 12.5, color: ONBOARDING_COLORS.textMuted }}>
                {t('onboarding.obSignInRestore' as never)}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {busy ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `${ONBOARDING_COLORS.background}E6`,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
          }}
        >
          <ActivityIndicator size="large" color={ONBOARDING_COLORS.warm} />
          <Text style={{ fontSize: 13.5, color: ONBOARDING_COLORS.textSecondary }}>
            {t('onboarding.obSignInSigningIn' as never)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const authInput = {
  backgroundColor: ONBOARDING_COLORS.cardBg,
  borderWidth: 1,
  borderColor: ONBOARDING_COLORS.cardBorderDefault,
  borderRadius: 14,
  borderCurve: 'continuous' as const,
  paddingHorizontal: 16,
  paddingVertical: 15,
  fontSize: 15,
  color: ONBOARDING_COLORS.textPrimary,
};

function authButton(backgroundColor: string, borderColor?: string) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 15,
    borderCurve: 'continuous' as const,
    backgroundColor,
    borderWidth: borderColor ? 1 : 0,
    borderColor: borderColor ?? 'transparent',
  };
}
