import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { captureException } from '../lib/analytics';
import { userFriendlyError } from '../lib/graphql-errors';
import { reportUnexpectedAuthError, signInWithApple, signInWithGoogle } from '../lib/oauth';
import { supabase } from '../lib/supabase';
import { AppleGlyph, GoogleGlyph } from './onboarding/oauth-glyphs';
import { ONBOARDING_COLORS } from './onboarding/onboarding-colors';

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

/** Bookmark glyph (matches the `bookmark` design icon — Feather/Lucide style). */
function BookmarkGlyph({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
  titleLead: 'onboarding.cpPromptTitleLead' as never,
  titleAccent: 'onboarding.cpPromptTitleAccent' as never,
  notNow: 'onboarding.cpPromptNotNow' as never,
} as const;

export function AccountPromptSheet({
  visible,
  context,
  onDismiss,
  onAuthenticated,
}: AccountPromptSheetProps) {
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
      reportUnexpectedAuthError(err, captureException);
      Alert.alert(t('common.error'), userFriendlyError(err));
    }
  };

  const handleEmail = async () => {
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
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(CP_KEY.notNow)}
          onPress={onDismiss}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Sheet — stops propagation so taps inside don't dismiss. */}
        <Animated.View
          entering={SlideInDown.duration(420)}
          style={{
            backgroundColor: ONBOARDING_COLORS.background,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            borderCurve: 'continuous',
            borderTopWidth: 1,
            borderColor: ONBOARDING_COLORS.line,
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: insets.bottom + 30,
          }}
        >
          <Pressable onPress={() => {}} accessible={false}>
            {/* Drag handle. */}
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: ONBOARDING_COLORS.textMuted,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            {/* Copper-tinted icon tile. */}
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.accentBg,
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.warm,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <BookmarkGlyph size={24} color={ONBOARDING_COLORS.warm2} />
            </View>

            {/* Title — "Save this to / your garage." */}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 28,
                lineHeight: 31,
                color: ONBOARDING_COLORS.textPrimary,
                letterSpacing: -0.6,
                marginBottom: 8,
              }}
            >
              {t(CP_KEY.titleLead)}{' '}
              <Text
                style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}
              >
                {t(CP_KEY.titleAccent)}
              </Text>
            </Text>

            {/* Context-aware body. */}
            <Text
              style={{
                fontFamily: 'Geist',
                fontSize: 14,
                color: ONBOARDING_COLORS.textSecondary,
                lineHeight: 20,
                maxWidth: 320,
                marginBottom: 20,
              }}
            >
              {t(BODY_KEY[context] as never)}
            </Text>

            {emailMode ? (
              <View style={{ gap: 12 }}>
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
                <Pressable
                  onPress={handleEmail}
                  disabled={!canSubmitEmail}
                  style={[
                    authButton(ONBOARDING_COLORS.warm),
                    { opacity: canSubmitEmail ? 1 : 0.5 },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.textOnAccent,
                    }}
                  >
                    {t('onboarding.obAccountCreate')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEmailMode(false)}
                  hitSlop={8}
                  style={{ alignSelf: 'center' }}
                >
                  <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.ink3, marginTop: 4 }}>
                    {t('onboarding.obAccountOtherOptions')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {process.env.EXPO_OS === 'ios' ? (
                  <Pressable onPress={handleApple} style={authButton(ONBOARDING_COLORS.textWhite)}>
                    <AppleGlyph size={18} color={ONBOARDING_COLORS.background} />
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
                  <GoogleGlyph size={18} />
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
              </View>
            )}

            {/* Dismiss. */}
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={{ alignSelf: 'center', marginTop: 16 }}
            >
              <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.ink3, fontWeight: '500' }}>
                {t(CP_KEY.notNow)}
              </Text>
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
      </Animated.View>
    </Modal>
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
