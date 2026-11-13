import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PAYWALL_TRIGGER } from '@/lib/paywall-session';
import { PAYWALL_SURFACE } from '@/lib/paywall-surfaces';
import { presentPaywall } from '@/lib/subscription';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { formatQuotaResetDay } from '../diagnosis/diagnostic-status';
import { useDiagnosticQuota } from '../diagnosis/use-diagnostic-quota';
import { useDiagnosticColors } from './diagnostic-colors';

/** The rider asked for it, so its paywall events carry `trigger: 'rider_tap'`. */
const LIMIT_PANEL_PAYWALL = {
  source: 'diagnose',
  feature: 'full_ai_diagnostics',
  surface: PAYWALL_SURFACE.DIAGNOSE_LIMIT_PANEL,
  trigger: PAYWALL_TRIGGER.RIDER_TAP,
} as const;

export const DIAGNOSE_LIMIT_TEST_ID = {
  PANEL: 'diagnose-limit-panel',
  SEE_PRO: 'diagnose-limit-see-pro',
  DONE: 'diagnose-limit-done',
} as const;

interface DiagnoseLimitPanelProps {
  onDone: () => void;
}

/**
 * Issue 365 T08: shown in place of the submit button once the server says the
 * free diagnosis is used. Neutral on purpose: it states when the free diagnosis
 * comes back and offers Pro only as a rider tap. There is no "Try Again", which
 * would only re-submit into the same limit (and paywall).
 */
export function DiagnoseLimitPanel({ onDone }: DiagnoseLimitPanelProps) {
  const { t, i18n } = useTranslation();
  const colors = useDiagnosticColors();
  const { resetDate } = useDiagnosticQuota();
  const resetDay = resetDate ? formatQuotaResetDay(resetDate, i18n.language) : null;
  const message = resetDay
    ? t('diagnose.limit.usedBackOn', { date: resetDay })
    : t('diagnose.limit.usedResetsNextMonth');

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      testID={DIAGNOSE_LIMIT_TEST_ID.PANEL}
      accessibilityLiveRegion="polite"
      style={{ gap: space.sm }}
    >
      <Text
        style={[type.body, { color: colors.textPrimary, textAlign: 'center' }]}
        accessibilityRole="text"
      >
        {message}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pressable
          testID={DIAGNOSE_LIMIT_TEST_ID.SEE_PRO}
          onPress={() => presentPaywall(LIMIT_PANEL_PAYWALL)}
          accessibilityRole="button"
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: space.md,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.cardBg,
            borderCurve: 'continuous',
          }}
        >
          <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>
            {t('diagnose.limit.seePro')}
          </Text>
        </Pressable>
        <Pressable
          testID={DIAGNOSE_LIMIT_TEST_ID.DONE}
          onPress={onDone}
          accessibilityRole="button"
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: space.md,
            borderRadius: radius.card,
            backgroundColor: colors.accent,
            borderCurve: 'continuous',
          }}
        >
          <Text style={[type.bodyStrong, { color: colors.onAccent }]}>
            {t('diagnose.limit.done')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
