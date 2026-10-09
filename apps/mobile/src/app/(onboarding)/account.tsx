import { withAlpha } from '@motovault/design-system';
import { useQuery } from '@tanstack/react-query';
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
import { authButton, authInput, authInputColors } from '../../components/auth/auth-styles';
import { EMAIL_CODE_SOURCE, EmailCodeStep } from '../../components/auth/email-code-step';
import { AppleGlyph, GoogleGlyph } from '../../components/onboarding/oauth-glyphs';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { AUTH_EMAIL_REDIRECT_TO } from '../../config/auth';
import { getPreviousRoute, OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import {
  useOnboardingNext,
  useOnboardingStep,
  useOnboardingVariant,
} from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { signUpConsentMetadata } from '../../lib/analytics-consent';
import { classifyAuthError, EMAIL_AUTH_ERROR, normalizeEmail } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { presentOAuthError } from '../../lib/oauth-error-alert';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { meOptions } from '../../lib/query-options';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { radius, space, type } from '../../theme/type';

/**
 * Post-paywall account step. Onboarding + the paywall run anonymously; the
 * account is requested HERE — framed as "secure your subscription" for
 * purchasers (RevenueCat aliases the anonymous purchase onto the Supabase UUID
 * via loginRevenueCat in _layout's onAuthStateChange), or "save your setup" for
 * free users. A Supabase session is required to enter the app + finish
 * onboarding, so this is the single auth gate (moved from before onboarding).
 */
export default function AccountScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.ACCOUNT);
  const goNext = useOnboardingNext(OB_SCREEN.ACCOUNT);
  const variant = useOnboardingVariant();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const session = useAuthStore((s) => s.session);

  /**
   * Back out of the auth gate. This screen used to be the only step in the flow
   * with neither a Back button nor a skip, and the sole exit was a real session
   * appearing — so a rider who declined to create an account had no way forward
   * OR backward, and relaunching landed them right back here (still anonymous,
   * `lastCompletedScreen: paywall`). That was a permanent lockout.
   *
   * Deliberately `getPreviousRoute` + `replace` rather than `useOnboardingBack`:
   * that hook prefers `router.back()`, which in the normal forward flow pops to
   * the paywall and re-presents the native modal — an account↔paywall loop.
   * `getPreviousRoute` skips the paywall (see AUTO_ADVANCE_SCREENS), landing on
   * the last real question instead.
   */
  const handleBack = () => {
    // From the code step, Back means "change email", never leaving onboarding.
    if (codeStep) {
      backFromCodeStep();
      return;
    }
    const hasBike = !!useOnboardingStore.getState().bikeData?.make;
    const previous = getPreviousRoute(variant, OB_SCREEN.ACCOUNT, { hasBike });
    if (previous) router.replace(previous);
  };

  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const advancedRef = useRef(false);

  // Back from the code step returns to the email form: the address stays, the
  // password is typed again. Android hardware back does the same instead of
  // popping the screen. Once a session exists the screen is advancing; the back
  // press is swallowed, matching the hidden Back button.
  const {
    codeStep,
    open: openCodeStep,
    openRateLimited: openCodeStepRateLimited,
    close: closeCodeStep,
    back: backFromCodeStep,
    onBusyChange: onCodeStepBusyChange,
  } = useEmailCodeStep({ clearPassword: () => setPassword(''), backLocked: !!session });

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.ACCOUNT, {
      context: isPro ? 'post_purchase' : 'post_paywall_free',
    });
  }, [isPro]);

  // Server onboarding state for the just-authenticated account. Shares the root
  // NavigationGate's cache key, so this is usually a cache hit (no extra fetch).
  // Drives the advance decision below; the returning-user case hinges on it.
  const meQuery = useQuery({ ...meOptions(), enabled: !!session });

  // A session appearing here means the account was created / signed in — record
  // it and advance. _layout keeps the onboarding stack mounted mid-sign-in, and
  // already calls loginRevenueCat(uuid) + identifyUser, so the anonymous
  // purchase aliases automatically.
  //
  // BUT: this screen also accepts returning users (Apple/Google don't separate
  // sign-up from sign-in, and the "Already have an account?" link lands here on
  // OAuth). For an account that has ALREADY completed onboarding, advancing into
  // the notifications step would flash it for ~1-2s before the root gate detects
  // onboardingCompleted and redirects to the app — the user can't actually act
  // on it. So we wait for the server onboarding state and only continue the flow
  // for accounts that still need it; already-onboarded accounts fall through to
  // the NavigationGate's (tabs) redirect with no flash.
  useEffect(() => {
    if (!session || advancedRef.current) return;
    // Wait for the server onboarding state to settle (unless it errored — then we
    // can't know, so proceed with the flow rather than strand the user here).
    if (meQuery.isLoading && !meQuery.isError) return;

    const alreadyOnboarded =
      (meQuery.data?.me?.preferences as { onboardingCompleted?: boolean } | null | undefined)
        ?.onboardingCompleted === true;

    advancedRef.current = true;
    // `account_created` used to fire here. Retired 2026-08-24: emitted from ONE
    // onboarding screen, it measured screen traversal rather than signup (154
    // events against 320 real signups) and became the broken denominator under
    // every activation tile. Signup is now counted server-side off the
    // public.users insert — see migration 00174 and SignupEventsService. The
    // client-side `user_signed_up` stays because it carries `auth_method` at the
    // moment of the auth call; the constant is kept so historical events still
    // resolve in PostHog.

    // Already-onboarded → let the root gate redirect to (tabs); don't push the
    // notifications step. New accounts → continue the onboarding flow.
    if (!alreadyOnboarded) goNext();
  }, [session, goNext, meQuery.isLoading, meQuery.isError, meQuery.data]);

  const handleApple = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signInWithApple();
    } catch (err) {
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleGoogle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signInWithGoogle();
    } catch (err) {
      presentOAuthError(err);
    }
  };

  const handleEmail = async () => {
    setBusy(true);
    // The code step verifies against this exact address, so sign up with it too.
    const address = normalizeEmail(email);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: {
          // The rider's analytics decision, for the server-side signup event.
          data: signUpConsentMetadata(),
          emailRedirectTo: AUTH_EMAIL_REDIRECT_TO,
        },
      });
      if (error) {
        const failure = classifyAuthError(error);
        if (failure.kind === EMAIL_AUTH_ERROR.RATE_LIMITED) {
          // A code went out moments ago (this is a repeat signup): enter it,
          // with the resend countdown already running.
          openCodeStepRateLimited(address, password, failure.retryAfterMs);
        } else {
          Alert.alert(t('common.error'), userFriendlyError(error));
        }
      } else if (data.user && !data.session) {
        // An empty `identities` array is Supabase's signal that this email is
        // ALREADY registered: with confirmations on, it suppresses the email
        // (enumeration protection) and returns an obfuscated user. Telling the
        // user to "check your email" here is a dead end — route them to sign in.
        if (data.user.identities?.length === 0) {
          Alert.alert(t('auth.accountExistsTitle'), t('auth.accountExistsMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.signIn'), onPress: () => router.push(OB_ROUTE.SIGN_IN) },
          ]);
        } else {
          // New (or still-unconfirmed) account: Supabase sent a code. The code
          // step confirms it and fires USER_SIGNED_UP on success.
          openCodeStep({ email: address, password });
          trackEvent(AnalyticsEvent.EMAIL_CODE_SENT, { source: EMAIL_CODE_SOURCE.SIGNUP });
        }
      } else if (data.session) {
        // New account with an active session (no email confirmation needed, e.g.
        // confirmations off locally). Never passes through the code step, so
        // this is the one USER_SIGNED_UP for the account.
        // OAuth paths fire USER_SIGNED_UP in oauth.ts; the email-in-onboarding
        // path must too, otherwise onboarding email signups never reach the
        // canonical signup metric (the Executive "Daily Signups" denominator).
        trackEvent(AnalyticsEvent.USER_SIGNED_UP, { auth_method: 'email' });
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
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      {/*
        Hidden while a signup is in flight. The blocking overlay below is a later
        sibling with no zIndex, so this button's zIndex:10 keeps it painted AND
        hit-testable through it: tapping Back mid-`signUp` unmounted this screen with
        the request pending, the session then landed with the rider on `commitment`,
        so the session effect never ran (no ACCOUNT_CREATED) and walking forward
        re-presented the paywall to someone who had already declined it.
      */}
      {busy || session ? null : (
        <OnboardingBackButton
          onPress={handleBack}
          style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
        />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: space.xl,
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
                gap: space.xxs,
                paddingVertical: space.xxs,
                paddingHorizontal: space.sm,
                borderRadius: radius.pill,
                borderCurve: 'continuous',
                backgroundColor: oc.surface2,
                marginBottom: space.lg,
              }}
            >
              <Text style={[type.label, { color: oc.textPrimary }]}>
                {t('onboarding.obAccountProBadge')}
              </Text>
            </Animated.View>
          ) : null}

          {/* EmailCodeStep has its own header; the screen's heading steps aside. */}
          {codeStep ? null : (
            <>
              <Animated.Text
                entering={FadeInUp.delay(60).duration(320)}
                accessibilityRole="header"
                style={[type.largeTitle, { color: oc.textPrimary, marginBottom: space.xs }]}
              >
                {isPro
                  ? t('onboarding.obAccountTitleProFull' as never)
                  : t('onboarding.obAccountTitleFreeFull' as never)}
              </Animated.Text>
              <Animated.Text
                entering={FadeInUp.delay(120).duration(320)}
                style={[
                  type.subhead,
                  { color: oc.textSecondary, maxWidth: 330, marginBottom: space.xl },
                ]}
              >
                {isPro
                  ? t('onboarding.obAccountSubtitlePro')
                  : t('onboarding.obAccountSubtitleFree')}
              </Animated.Text>
            </>
          )}

          {codeStep ? (
            <EmailCodeStep
              email={codeStep.email}
              source={EMAIL_CODE_SOURCE.SIGNUP}
              password={codeStep.password}
              initialCooldownMs={codeStep.initialCooldownMs}
              onBack={closeCodeStep}
              onBusyChange={onCodeStepBusyChange}
              onNeedsSignIn={() => router.push(OB_ROUTE.SIGN_IN)}
            />
          ) : emailMode ? (
            <Animated.View entering={FadeInUp.duration(280)} style={{ gap: space.sm }}>
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
                <Text style={[type.label, { color: oc.ink3, marginTop: space.xxs }]}>
                  {t('onboarding.obAccountOtherOptions')}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.delay(180).duration(280)} style={{ gap: space.sm }}>
              {process.env.EXPO_OS === 'ios' ? (
                <Pressable onPress={handleApple} style={authButton(oc.textWhite)}>
                  <AppleGlyph size={18} color={oc.background} />
                  <Text style={[type.bodyStrong, { color: oc.background }]}>
                    {t('auth.continueWithApple')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleGoogle} style={authButton(oc.cardBg, oc.cardBorderDefault)}>
                <GoogleGlyph size={18} />
                <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                  {t('auth.continueWithGoogle')}
                </Text>
              </Pressable>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  marginVertical: space.xxs,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: oc.line }} />
                <Text style={[type.caption, { color: oc.textMuted }]}>
                  {t('onboarding.obAccountOrEmail')}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: oc.line }} />
              </View>
              <Pressable onPress={() => setEmailMode(true)} style={authButton(oc.surface2)}>
                <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
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
              gap: space.xs,
              marginTop: space.lg,
            }}
          >
            <ShieldCheck size={14} color={oc.success} />
            <Text style={[type.caption, { color: oc.ink3 }]}>
              {isPro
                ? t('onboarding.obAccountReassurancePro')
                : t('onboarding.obAccountReassuranceFree')}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push(OB_ROUTE.SIGN_IN)}
            hitSlop={8}
            style={{
              alignSelf: 'center',
              justifyContent: 'center',
              minHeight: 44,
              marginTop: space.sm,
            }}
          >
            <Text style={[type.label, { color: oc.warm2 }]}>
              {t('onboarding.obAccountHaveAccount')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {busy || session ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: withAlpha(oc.background, 0.9),
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
          }}
        >
          <ActivityIndicator size="large" color={oc.warm} />
          <Text style={[type.subhead, { color: oc.textSecondary }]}>
            {t('onboarding.obAccountCreating')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
