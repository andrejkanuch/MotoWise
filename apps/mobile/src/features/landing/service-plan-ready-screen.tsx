import { type Href, useRouter } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BIKE_ORIGIN, BIKE_SEGMENT } from '@/lib/bike-hub/constants';
import { LANDING_SHEET, LANDING_SHEET_TEST_ID } from '@/lib/landing-sheet-queue';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { GUTTER, space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';

const ICON_BOX = 52;
const BUTTON_HEIGHT = 52;

interface ServicePlanReadyProps {
  motorcycleId: string;
  bikeName?: string;
}

/**
 * "Service plan ready" (the OEM-imported sheet, issue 365 T16b): shown over
 * Home once after onboarding imported the bike's service plan, when the
 * landing-sheet queue gives it the session's one sheet.
 */
export function ServicePlanReadyScreen({ motorcycleId, bikeName }: ServicePlanReadyProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // One navigation per sheet: a double tap must not open the plan twice.
  const leaving = useRef(false);

  const openPlan = () => {
    if (leaving.current) return;
    leaving.current = true;
    triggerImpact();
    // One action from the sheet (react-native-screens issue 4446): dismissTo pops
    // the sheet onto the tabs and opens the bike's Service segment inside them.
    router.dismissTo({
      pathname: '/(tabs)/(garage)/bike/[id]',
      params: { id: motorcycleId, segment: BIKE_SEGMENT.SERVICE, from: BIKE_ORIGIN.HOME },
    } as Href);
  };

  const close = () => {
    if (leaving.current) return;
    leaving.current = true;
    router.back();
  };

  return (
    // Scrolls so both actions stay reachable at the largest text sizes.
    <ScrollView
      testID={LANDING_SHEET_TEST_ID[LANDING_SHEET.SERVICE_PLAN_READY]}
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: GUTTER,
        // The route is pushed as a full page over the tabs, so clear the status bar.
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + space.md,
        gap: space.md,
      }}
    >
      <Animated.View entering={FadeInUp.duration(240)} style={{ gap: space.sm }}>
        <View
          style={{
            width: ICON_BOX,
            height: ICON_BOX,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: tint(theme.warm, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wrench size={26} color={theme.warm} strokeWidth={2} />
        </View>
        <Text accessibilityRole="header" style={[type.sheetTitle, { color: theme.ink }]}>
          {t('landing.servicePlanReady.title')}
        </Text>
        <Text style={[type.body, { color: theme.ink2 }]}>
          {bikeName
            ? t('landing.servicePlanReady.body', { bike: bikeName })
            : t('landing.servicePlanReady.bodyNoBike')}
        </Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Pressable
        testID="service-plan-ready-open"
        onPress={openPlan}
        accessibilityRole="button"
        style={({ pressed }) => ({
          minHeight: BUTTON_HEIGHT,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          backgroundColor: theme.warm,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={[type.bodyStrong, { color: theme.onWarm }]}>
          {t('landing.servicePlanReady.open')}
        </Text>
      </Pressable>
      <Pressable
        testID="service-plan-ready-dismiss"
        onPress={close}
        accessibilityRole="button"
        hitSlop={space.xs}
        style={{ minHeight: BUTTON_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={[type.bodyStrong, { color: theme.ink2 }]}>
          {t('landing.servicePlanReady.notNow')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
