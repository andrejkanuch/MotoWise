import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, captureException } from '../../lib/analytics';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth.store';
import { useSubscriptionStore } from '../../stores/subscription.store';

/**
 * Post-paywall account step. Onboarding + the paywall run anonymously; the
 * account is requested HERE — framed as "secure your subscription" for
 * purchasers (RevenueCat aliases the anonymous purchase onto the Supabase UUID
 * via loginRevenueCat in _layout's onAuthStateChange), or "save your setup" for
 * free users. A Supabase session is required to enter the app + finish
 * onboarding, so this is the single auth gate (moved from before onboarding).
 */
export default function AccountScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.ACCOUNT);
  const goNext = useOnboardingNext(OB_SCREEN.ACCOUNT);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const session = useAuthStore((s) => s.session);

  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const advancedRef = useRef(false);
  const methodRef = useRef<'apple' | 'google' | 'email'>('email');

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.ACCOUNT, {
      context: isPro ? 'post_purchase' : 'post_paywall_free',
    });
  }, [isPro]);

  // A session appearing here means the account was created / signed in — record
  // it and advance. _layout keeps the onboarding stack mounted mid-sign-in, and
  // already calls loginRevenueCat(uuid) + identifyUser, so the anonymous
  // purchase aliases automatically.
  useEffect(() => {
    if (!session || advancedRef.current) return;
    advancedRef.current = true;
    trackOnboardingEvent(AnalyticsEvent.ACCOUNT_CREATED, OB_SCREEN.ACCOUNT, {
      context: isPro ? 'post_purchase' : 'post_paywall_free',
      method: methodRef.current,
    });
    goNext();
  }, [session, isPro, goNext]);

  const handleApple = async () => {
    methodRef.current = 'apple';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signInWithApple();
    } catch (err) {
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleGoogle = async () => {
    methodRef.current = 'google';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signInWithGoogle();
    } catch (err) {
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleEmail = async () => {
    methodRef.current = 'email';
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://motovault.app/auth/callback?redirect=motovault://auth/callback',
        },
      });
      if (error) {
        Alert.alert(t('common.error'), userFriendlyError(error));
      } else if (data.user && !data.session) {
        // Email confirmation required — can't proceed into the app yet.
        Alert.alert(t('auth.checkEmail'), t('auth.confirmationSent'));
      }
      // data.session present → onAuthStateChange fires → session effect advances.
    } catch (err) {
      captureException(err);
      Alert.alert(t('common.error'), userFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const canSubmitEmail = email.length > 0 && password.length > 0 && !busy;

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 26,
            paddingTop: 80,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isPro ? (
            <Animated.View
              entering={FadeInUp.duration(320)}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.accentBg,
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.warm,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontFamily: 'GeistMono-Medium',
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: ONBOARDING_COLORS.warm2,
                }}
              >
                {t('onboarding.obAccountProBadge')}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.Text
            entering={FadeInUp.delay(60).duration(320)}
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 34,
              lineHeight: 37,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
              marginBottom: 10,
            }}
          >
            {isPro ? t('onboarding.obAccountTitlePro') : t('onboarding.obAccountTitleFree')}{' '}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {isPro
                ? t('onboarding.obAccountTitleProItalic')
                : t('onboarding.obAccountTitleFreeItalic')}
            </Text>
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.delay(120).duration(320)}
            style={{
              fontSize: 14.5,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 21,
              maxWidth: 330,
              marginBottom: 26,
            }}
          >
            {isPro ? t('onboarding.obAccountSubtitlePro') : t('onboarding.obAccountSubtitleFree')}
          </Animated.Text>

          {emailMode ? (
            <Animated.View entering={FadeInUp.duration(280)} style={{ gap: 12 }}>
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
                autoComplete="new-password"
                style={authInput}
              />
              <OnboardingContinueButton
                label={t('onboarding.obAccountCreate')}
                onPress={handleEmail}
                disabled={!canSubmitEmail}
                showIcon={false}
              />
              <Pressable
                onPress={() => setEmailMode(false)}
                hitSlop={8}
                style={{ alignSelf: 'center' }}
              >
                <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.ink3, marginTop: 4 }}>
                  {t('onboarding.obAccountOtherOptions')}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.delay(180).duration(320)} style={{ gap: 11 }}>
              {process.env.EXPO_OS === 'ios' ? (
                <Pressable onPress={handleApple} style={authButton(ONBOARDING_COLORS.textWhite)}>
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.background,
                    }}
                  >
                    {t('auth.continueWithApple')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleGoogle}
                style={authButton(ONBOARDING_COLORS.cardBg, ONBOARDING_COLORS.cardBorderDefault)}
              >
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: ONBOARDING_COLORS.textPrimary }}
                >
                  G
                </Text>
                <Text
                  style={{
                    fontSize: 15.5,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textPrimary,
                  }}
                >
                  {t('auth.continueWithGoogle')}
                </Text>
              </Pressable>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 3 }}
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
              <Pressable
                onPress={() => setEmailMode(true)}
                style={authButton('transparent', ONBOARDING_COLORS.cardBorderDefault)}
              >
                <Text
                  style={{
                    fontSize: 15.5,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textSecondary,
                  }}
                >
                  {t('onboarding.obAccountWithEmail')}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 22,
            }}
          >
            <ShieldCheck size={14} color={ONBOARDING_COLORS.success} />
            <Text style={{ fontSize: 12.5, color: ONBOARDING_COLORS.ink3 }}>
              {isPro
                ? t('onboarding.obAccountReassurancePro')
                : t('onboarding.obAccountReassuranceFree')}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(OB_ROUTE.SIGN_IN)}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 18 }}
          >
            <Text style={{ fontSize: 13.5, color: ONBOARDING_COLORS.warm2, fontWeight: '600' }}>
              {t('onboarding.obAccountHaveAccount')}
            </Text>
          </Pressable>
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
            {t('onboarding.obAccountCreating')}
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
