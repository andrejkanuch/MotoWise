import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  AuthBusyOverlay,
  AuthDivider,
  AuthField,
  OAuthButtons,
} from '../../components/auth/auth-field';
import { authButton } from '../../components/auth/auth-styles';
import { EMAIL_CODE_SOURCE, EmailCodeStep } from '../../components/auth/email-code-step';
import { AccountProBadge } from '../../components/onboarding/account-pro-badge';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import {
  OnboardingShell,
  OnboardingTextButton,
} from '../../components/onboarding/onboarding-shell';
import { useAccountAdvance } from '../../components/onboarding/use-account-advance';
import { hasAccountDraft, useAccountDraft } from '../../components/onboarding/use-account-draft';
import { AUTH_EMAIL_MODE, AUTH_EMAIL_REDIRECT_TO, AUTH_SURFACE } from '../../config/auth';
import { getPreviousRoute, OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { useEmailCodeStep } from '../../hooks/use-email-code-step';
import { useOAuthSignIn } from '../../hooks/use-oauth-sign-in';
import { useOnboardingNext, useOnboardingVariant } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { signUpConsentMetadata } from '../../lib/analytics-consent';
import { classifyAuthError, EMAIL_AUTH_ERROR, normalizeEmail } from '../../lib/email-confirmation';
import { userFriendlyError } from '../../lib/graphql-errors';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { trackOnboardingReplaceBack } from '../../lib/onboarding-nav-analytics';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { space } from '../../theme/spacing';
import { type } from '../../theme/type';

const IS_IOS = process.env.EXPO_OS === 'ios';
const SURFACE = AUTH_SURFACE.ONBOARDING_ACCOUNT;

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
  const router = useRouter();
  const goNext = useOnboardingNext(OB_SCREEN.ACCOUNT);
  const variant = useOnboardingVariant();
  const isPro = useSubscriptionStore((s) => s.isPro);
  const session = useAuthStore((s) => s.session);

  /**
   * Back out of the auth gate. This screen used to be the only step in the flow with neither a Back
   * button nor a skip, and the sole exit was a real session appearing — so a rider who declined to
   * create an account had no way forward OR backward, and relaunching landed them right back here
   * (still anonymous, `lastCompletedScreen: paywall`). That was a permanent lockout.
   *
   * Deliberately `getPreviousRoute` + `replace` rather than `useOnboardingBack`: that hook prefers
   * `router.back()`, which in the normal forward flow pops to the paywall and re-presents the
   * native modal — an account↔paywall loop. `getPreviousRoute` skips the paywall (see
   * AUTO_ADVANCE_SCREENS), landing on the last real question instead (`onboarding_back`, T04b).
   */
  const handleBack = () => {
    // From the code step, Back means "change email", never leaving onboarding.
    if (codeStep) return backFromCodeStep();
    const hasBike = !!useOnboardingStore.getState().bikeData?.make;
    const previous = getPreviousRoute(variant, OB_SCREEN.ACCOUNT, { hasBike });
    if (!previous) return;
    trackOnboardingReplaceBack(OB_SCREEN.ACCOUNT, previous);
    router.replace(previous);
  };

  // Back on the email form or code step the rider left before a relaunch (issue 365 T13a).
  const [emailMode, setEmailMode] = useState(hasAccountDraft);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Back from the code step returns to the email form: the address stays, the
  // password is typed again. Android hardware back does the same instead of
  // popping the screen. Once a session exists the screen is advancing; the back
  // press is swallowed, matching the hidden Back button. An open step survives a
  // relaunch for an hour; after that the form opens with the address (FS-OB3).
  const {
    codeStep,
    open: openCodeStep,
    openRateLimited: openCodeStepRateLimited,
    close: closeCodeStep,
    back: backFromCodeStep,
    onBusyChange: onCodeStepBusyChange,
  } = useEmailCodeStep({
    clearPassword: () => setPassword(''),
    backLocked: !!session,
    persistDraft: true,
    onStaleDraft: (address) => {
      setEmail(address);
      setEmailMode(true);
    },
  });
  useAccountDraft(emailMode, codeStep !== null);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.ACCOUNT, {
      context: isPro ? 'post_purchase' : 'post_paywall_free',
    });
  }, [isPro]);

  // Once a session exists: wait for the server onboarding state, then advance.
  useAccountAdvance(!!session, goNext);

  const { onApple, onGoogle, busyProvider } = useOAuthSignIn(SURFACE);

  const handleEmail = async () => {
    setBusy(true);
    trackEvent(AnalyticsEvent.AUTH_EMAIL_SUBMITTED, {
      surface: SURFACE,
      mode: AUTH_EMAIL_MODE.SIGNUP,
    });
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
        // OAuth paths fire USER_SIGNED_UP from useOAuthSignIn; the email-in-onboarding
        // path must too, otherwise onboarding email signups never reach the
        // canonical signup metric (the Executive "Daily Signups" denominator).
        trackEvent(AnalyticsEvent.USER_SIGNED_UP, { auth_method: 'email', surface: SURFACE });
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
    <View style={{ flex: 1 }}>
      <OnboardingShell
        screen={OB_SCREEN.ACCOUNT}
        // Hidden while a signup is in flight or a session exists: tapping Back
        // mid-`signUp` unmounted this screen with the request pending, the
        // session then landed with the rider on `commitment`, and walking
        // forward re-presented the paywall to someone who had already declined it.
        onBack={busy || session ? undefined : handleBack}
        // EmailCodeStep has its own header; the screen's heading steps aside.
        title={
          codeStep
            ? undefined
            : isPro
              ? t('onboarding.obAccountTitleProFull')
              : t('onboarding.obAccountTitleFreeFull')
        }
        subtitle={
          codeStep
            ? undefined
            : isPro
              ? t('onboarding.obAccountSubtitlePro')
              : t('onboarding.obAccountSubtitleFree')
        }
        primary={
          emailMode && !codeStep
            ? {
                label: t('onboarding.obAccountCreate'),
                onPress: handleEmail,
                disabled: !canSubmitEmail,
              }
            : undefined
        }
        secondary={{
          label: t('onboarding.obAccountHaveAccount'),
          onPress: () => router.push(OB_ROUTE.SIGN_IN),
        }}
      >
        {isPro && !codeStep ? <AccountProBadge /> : null}

        {codeStep ? (
          <EmailCodeStep
            email={codeStep.email}
            surface={SURFACE}
            source={EMAIL_CODE_SOURCE.SIGNUP}
            password={codeStep.password}
            initialCooldownMs={codeStep.initialCooldownMs}
            onBack={closeCodeStep}
            onBusyChange={onCodeStepBusyChange}
            onNeedsSignIn={() => router.push(OB_ROUTE.SIGN_IN)}
          />
        ) : emailMode ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.md }}>
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
            <OnboardingTextButton
              label={t('onboarding.obAccountOtherOptions')}
              onPress={() => setEmailMode(false)}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.sm }}>
            <OAuthButtons onApple={onApple} onGoogle={onGoogle} busyProvider={busyProvider} />
            <AuthDivider label={t('onboarding.obAccountOrEmail')} />
            <Pressable
              onPress={() => setEmailMode(true)}
              accessibilityRole="button"
              android_ripple={{ color: oc.line, foreground: true }}
              style={({ pressed }) => [
                authButton(oc.surface2),
                { overflow: 'hidden', opacity: pressed && IS_IOS ? 0.85 : 1 },
              ]}
            >
              <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                {t('onboarding.obAccountWithEmail')}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {codeStep ? null : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              marginTop: space.xl,
            }}
          >
            <ShieldCheck size={14} color={oc.success} />
            <Text style={[type.caption, { color: oc.textMuted, flexShrink: 1 }]}>
              {isPro
                ? t('onboarding.obAccountReassurancePro')
                : t('onboarding.obAccountReassuranceFree')}
            </Text>
          </View>
        )}
      </OnboardingShell>

      {busy || session ? <AuthBusyOverlay label={t('onboarding.obAccountCreating')} /> : null}
    </View>
  );
}
