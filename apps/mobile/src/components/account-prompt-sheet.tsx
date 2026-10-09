import { withAlpha } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Bookmark } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_EMAIL_REDIRECT_TO } from '../config/auth';
import { captureException } from '../lib/analytics';
import { signUpConsentMetadata } from '../lib/analytics-consent';
import { userFriendlyError } from '../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../lib/oauth';
import { presentOAuthError } from '../lib/oauth-error-alert';
import { supabase } from '../lib/supabase';
import { radius, space, type } from '../theme/type';
import { authButton, authInput, authInputColors } from './auth/auth-styles';
import { AppleGlyph, GoogleGlyph } from './onboarding/oauth-glyphs';
import { useOnboardingColors } from './onboarding/onboarding-colors';

/**
 * Contextual "Save this to your garage" account-save bottom sheet (design name
 * `FCPPrompt`). NOT part of the linear onboarding flow — it's a reusable
 * controlled sheet shown when a signed-out / anonymous user tries to save a
 * ride, expense, or bike, framed around the value already on screen ("there's
 * already something worth saving").
 *
 * Auth reuses the exact same helpers the onboarding `account.tsx` screen uses
 * (`signInWithApple`, `signInWithGoogle`, `supabase.auth.signUp`). Because auth
 * success is observed via `onAuthStateChange` elsewhere (the app's auth store),
 * the sheet optimistically fires `onAuthenticated` after a successful OAuth /
 * sign-up call so callers can retry the save once the session lands.
 */

type AccountPromptContext = 'ride' | 'expense' | 'bike';

type AccountPromptSheetProps = {
  /** Controls visibility — render the sheet whenever a save is gated. */
  visible: boolean;
  /** What the user was trying to save — drives the body copy. */
  context: AccountPromptContext;
  /** Called when the user dismisses (scrim tap, "Not now", or back). */
  onDismiss: () => void;
  /** Called after a successful auth attempt so the caller can retry the save. */
  onAuthenticated?: () => void;
};

/** Body-copy key per context — avoids a magic-string switch in the JSX. */
const BODY_KEY: Record<AccountPromptContext, string> = {
  ride: 'onboarding.cpPromptBodyRide',
  expense: 'onboarding.cpPromptBodyExpense',
  bike: 'onboarding.cpPromptBodyBike',
};

/**
 * New camelCase keys added for this sheet that are not yet present in the typed
 * i18n resources. Cast through `as never` per the project convention so the
 * typed-resources `t()` overload accepts them until the locale JSON is updated.
 */
const CP_KEY = {
  title: 'onboarding.cpPromptTitle' as never,
  notNow: 'onboarding.cpPromptNotNow' as never,
} as const;

export function AccountPromptSheet({
  visible,
  context,
  onDismiss,
  onAuthenticated,
}: AccountPromptSheetProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleApple = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signInWithApple();
      onAuthenticated?.();
      onDismiss();
    } catch (err) {
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleGoogle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signInWithGoogle();
      onAuthenticated?.();
      onDismiss();
    } catch (err) {
      presentOAuthError(err);
    }
  };

  const handleEmail = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // The rider's analytics decision, for the server-side signup event.
          data: signUpConsentMetadata(),
          emailRedirectTo: AUTH_EMAIL_REDIRECT_TO,
        },
      });
      if (error) {
        Alert.alert(t('common.error'), userFriendlyError(error));
      } else if (data.user && !data.session) {
        // Email confirmation required — can't complete the save yet.
        Alert.alert(t('auth.checkEmail'), t('auth.confirmationSent'));
      } else if (data.session) {
        onAuthenticated?.();
        onDismiss();
      }
    } catch (err) {
      captureException(err);
      Alert.alert(t('common.error'), userFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const canSubmitEmail = email.length > 0 && password.length > 0 && !busy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Scrim — tapping dismisses. */}
      <Animated.View
        entering={FadeIn.duration(220)}
        style={{
          flex: 1,
          backgroundColor: oc.surfaceOverlayDark,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(CP_KEY.notNow)}
          onPress={onDismiss}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Sheet — stops propagation so taps inside don't dismiss. */}
        <Animated.View
          entering={SlideInDown.duration(280)}
          style={{
            backgroundColor: oc.surface,
            borderTopLeftRadius: radius.plate,
            borderTopRightRadius: radius.plate,
            borderCurve: 'continuous',
            paddingHorizontal: space.xl,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.xxl,
          }}
        >
          <Pressable onPress={() => {}} accessible={false}>
            {/* Drag handle. */}
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: oc.borderMuted,
                alignSelf: 'center',
                marginBottom: space.lg,
              }}
            />

            {/* Icon tile. */}
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                backgroundColor: oc.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: space.md,
              }}
            >
              <Bookmark size={24} color={oc.textPrimary} strokeWidth={1.75} />
            </View>

            <Text
              accessibilityRole="header"
              style={[type.sheetTitle, { color: oc.textPrimary, marginBottom: space.xs }]}
            >
              {t(CP_KEY.title)}
            </Text>

            {/* Context-aware body. */}
            <Text
              style={[
                type.subhead,
                { color: oc.textSecondary, maxWidth: 320, marginBottom: space.lg },
              ]}
            >
              {t(BODY_KEY[context] as never)}
            </Text>

            {emailMode ? (
              <View style={{ gap: space.sm }}>
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
                  onPress={handleEmail}
                  disabled={!canSubmitEmail}
                  style={[authButton(oc.warm), { opacity: canSubmitEmail ? 1 : 0.5 }]}
                >
                  <Text style={[type.bodyStrong, { color: oc.textOnAccent }]}>
                    {t('onboarding.obAccountCreate')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEmailMode(false)}
                  hitSlop={8}
                  style={{ alignSelf: 'center' }}
                >
                  <Text style={[type.label, { color: oc.ink3, marginTop: space.xxs }]}>
                    {t('onboarding.obAccountOtherOptions')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: space.sm }}>
                {process.env.EXPO_OS === 'ios' ? (
                  <Pressable onPress={handleApple} style={authButton(oc.textWhite)}>
                    <AppleGlyph size={18} color={oc.background} />
                    <Text style={[type.bodyStrong, { color: oc.background }]}>
                      {t('auth.continueWithApple')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleGoogle}
                  style={authButton(oc.cardBg, oc.cardBorderDefault)}
                >
                  <GoogleGlyph size={18} />
                  <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                    {t('auth.continueWithGoogle')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setEmailMode(true)} style={authButton(oc.surface2)}>
                  <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                    {t('onboarding.obAccountWithEmail')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Dismiss. */}
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={{
                alignSelf: 'center',
                justifyContent: 'center',
                minHeight: 44,
                marginTop: space.xs,
              }}
            >
              <Text style={[type.label, { color: oc.ink3 }]}>{t(CP_KEY.notNow)}</Text>
            </Pressable>
          </Pressable>
        </Animated.View>

        {busy ? (
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
      </Animated.View>
    </Modal>
  );
}
