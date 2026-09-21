import { palette } from '@motovault/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AUTH_HYDRATION_ESCAPE_MS } from '../../lib/auth-hydration';

/**
 * Shown when auth hydration timed out with no answer.
 *
 * Deliberately NOT the login screen: at this point we do not know whether the
 * rider is signed in, and claiming they are signed out is the defect — a
 * returning rider on a slow cold start was routed to /login while a perfectly
 * good session was still being read from the Keychain.
 *
 * Bounded by construction: after AUTH_HYDRATION_ESCAPE_MS an explicit escape
 * hatch appears, so this screen can never wedge the app even if hydration never
 * answers at all.
 *
 * This is expo-router 57's documented pattern, not a workaround: "With Expo
 * Router, something must be rendered to the screen while loading the initial
 * auth state" (docs.expo.dev/router/advanced/authentication-rewrites).
 * `Stack.Protected` takes a plain boolean `guard` and has no indeterminate
 * state, so the guard must not be computed until the answer is real.
 */
export function SessionRestoring({ onGiveUp }: { onGiveUp: () => void }) {
  const { t } = useTranslation();
  const [canGiveUp, setCanGiveUp] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setCanGiveUp(true), AUTH_HYDRATION_ESCAPE_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingHorizontal: 32,
        backgroundColor: palette.editorialDarkBg2,
      }}
    >
      <ActivityIndicator color={palette.signature500} />
      <Text
        style={{
          color: palette.editorialDarkInk,
          fontSize: 16,
          textAlign: 'center',
        }}
      >
        {t('auth.restoringSession')}
      </Text>
      {canGiveUp ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <Pressable
            accessibilityRole="button"
            onPress={onGiveUp}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: palette.signature500,
            }}
          >
            <Text style={{ color: palette.signature500, fontSize: 15 }}>
              {t('auth.signInInstead')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
