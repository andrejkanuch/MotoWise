import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  DEADLINE_LOCK_PHASE,
  type DeadlineLock,
  SUBMIT_FAILURE,
  type SubmitFailure,
} from '@/stores/diagnostic-flow.store';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { useDiagnosticColors } from './diagnostic-colors';

interface SubmitStatusProps {
  failure: SubmitFailure | null;
  lock: DeadlineLock | null;
  /** Reruns the quota check after a failed one. */
  onRetryCheck: () => void;
}

/**
 * Issue 365 T17 (FS-PO2b): the line above Analyze after a submit that did not
 * produce a diagnosis. Localized copy per failure class, never the server text.
 * After the client deadline it says the diagnosis may still arrive, and never
 * that the free diagnosis was kept: the server can still finish and use it.
 */
export function SubmitStatus({ failure, lock, onRetryCheck }: SubmitStatusProps) {
  const { t } = useTranslation();
  const colors = useDiagnosticColors();

  const failureCopy: Record<SubmitFailure, string> = {
    [SUBMIT_FAILURE.OFFLINE]: t('diagnoseV2.submit.offline'),
    [SUBMIT_FAILURE.THROTTLED]: t('diagnoseV2.submit.throttled'),
    [SUBMIT_FAILURE.SERVER]: t('diagnoseV2.submit.server'),
  };

  if (lock) {
    const checkFailed = lock.phase === DEADLINE_LOCK_PHASE.CHECK_FAILED;
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        accessibilityLiveRegion="polite"
        style={{ gap: space.xs, marginBottom: space.xs, alignItems: 'center' }}
      >
        <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center' }]}>
          {checkFailed ? t('diagnoseV2.submit.checkFailed') : t('diagnoseV2.submit.deadline')}
        </Text>
        {checkFailed && (
          <Pressable
            onPress={onRetryCheck}
            accessibilityRole="button"
            hitSlop={space.xs}
            style={{
              paddingVertical: space.xs,
              paddingHorizontal: space.md,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: colors.cardBg,
              borderCurve: 'continuous',
            }}
          >
            <Text style={[type.bodyStrong, { color: colors.textPrimary }]}>
              {t('diagnoseV2.submit.retryCheck')}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    );
  }

  if (!failure) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ marginBottom: space.xs }}>
      <Text style={[type.body, { color: colors.danger, textAlign: 'center' }]}>
        {failureCopy[failure]}
      </Text>
    </View>
  );
}
