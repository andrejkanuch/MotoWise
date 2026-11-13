import { useGlobalSearchParams, useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OB_NOTICE, OB_NOTICE_PARAM } from '../../config/onboarding';
import { GUTTER, space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { useOnboardingColors } from './onboarding-colors';

/** How long the notice stays up. */
export const ACCOUNT_READY_NOTICE_MS = 4000;
/** Clears the onboarding top bar (44pt back control + progress track). */
const TOP_BAR_HEIGHT = 44;

/**
 * "Account ready — let's set up your garage" (issue 365 T11, FS-OB1a): shown once
 * on the onboarding step the sign-in screen moved a not-yet-onboarded account to,
 * i.e. whenever the focused onboarding route carries `notice=account_ready`.
 *
 * It clears the param as soon as it shows, so a re-render or a Back to that step
 * never brings it back, announces itself to screen readers once, and goes away
 * after ACCOUNT_READY_NOTICE_MS. Rendered over the onboarding stack by its layout,
 * so it works on any step the rider resumes at; it never takes touches.
 */
export function AccountReadyNotice() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const notice = useGlobalSearchParams<{ [OB_NOTICE_PARAM]?: string }>()[OB_NOTICE_PARAM];
  const [visible, setVisible] = useState(false);
  const message = t('onboarding.obAccountReadyNotice');

  useEffect(() => {
    if (notice !== OB_NOTICE.ACCOUNT_READY) return;
    setVisible(true);
    router.setParams({ [OB_NOTICE_PARAM]: undefined });
    AccessibilityInfo.announceForAccessibility(message);
  }, [notice, router, message]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), ACCOUNT_READY_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + TOP_BAR_HEIGHT + space.xs,
        left: GUTTER,
        right: GUTTER,
      }}
    >
      <Animated.View
        testID="onboarding-account-ready"
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
        exiting={reduceMotion ? undefined : FadeOut.duration(200)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: oc.line,
          backgroundColor: oc.surface2,
        }}
      >
        <CircleCheck size={20} color={oc.success} />
        <Text style={[type.subhead, { flex: 1, color: oc.textPrimary }]}>{message}</Text>
      </Animated.View>
    </View>
  );
}
