import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
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
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
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
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert(t('common.error'), userFriendlyError(error));
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
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={24} color={ONBOARDING_COLORS.textPrimary} />
      </Pressable>

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
          <Animated.Text
            entering={FadeInUp.duration(320)}
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 36,
              lineHeight: 38,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
              marginBottom: 8,
            }}
          >
            {t('onboarding.obSignInTitle')}
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
              <Text
                style={{ fontSize: 18, fontWeight: '700', color: ONBOARDING_COLORS.textPrimary }}
              >
                G
              </Text>
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
            <OnboardingContinueButton
              label={t('auth.signIn')}
              onPress={handleEmail}
              disabled={!canSubmit}
              showIcon={false}
            />
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
          }}
        >
          <ActivityIndicator size="large" color={ONBOARDING_COLORS.warm} />
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
