import { palette } from '@motovault/design-system';
import { CircleOff } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useTabBarClearance } from '../../hooks/use-tab-bar-clearance';
import { useRideNoticeStore } from '../../stores/ride-notice.store';
import { useEditorialTheme } from '../../theme/editorial';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { MIN_RIDE_DISTANCE_M, MIN_RIDE_ELAPSED_S } from '../../utils/ride-constants';

/** Long enough to read two lines; the rider is not asked to act on it. */
const VISIBLE_MS = 4_000;
const ICON_SIZE = 20;

/**
 * "Not saved" toast after the guard's "End without saving" (issue 365 T09, owner
 * decision D3). Mounted at the app root so it outlives the HUD and shows on Home,
 * in the app theme (light or dark), above the tab bar.
 */
export function RideNotSavedToast() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const notSavedAt = useRideNoticeStore((s) => s.notSavedAt);
  const clearNotSaved = useRideNoticeStore((s) => s.clearNotSaved);
  const bottom = useTabBarClearance(space.sm);
  const message = t('rideHud.notSavedToast', {
    seconds: MIN_RIDE_ELAPSED_S,
    meters: MIN_RIDE_DISTANCE_M,
  });

  useEffect(() => {
    if (notSavedAt == null) return;
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(clearNotSaved, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notSavedAt, clearNotSaved, message]);

  if (notSavedAt == null) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutDown.duration(200)}
      pointerEvents="none"
      style={{ position: 'absolute', left: space.md, right: space.md, bottom, zIndex: 200 }}
    >
      <View
        accessibilityRole="alert"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.line,
          shadowColor: palette.black,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <CircleOff size={ICON_SIZE} color={theme.ink2} strokeWidth={2.5} />
        <Text style={{ ...type.bodyStrong, color: theme.ink, flex: 1 }}>{message}</Text>
      </View>
    </Animated.View>
  );
}
