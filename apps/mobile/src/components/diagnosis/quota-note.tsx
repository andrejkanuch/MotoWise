import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { useDiagnosticQuota } from '@/hooks/use-diagnostic-quota';
import { useEditorialTheme } from '@/theme/editorial';
import { space, type } from '@/theme/type';
import { formatQuotaResetDate } from './diagnostic-status';

/**
 * Free riders see their monthly allowance next to the diagnose CTA, so the
 * limit is never a surprise at the end of the form. Pro shows nothing.
 */
export function QuotaNote() {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const quota = useDiagnosticQuota();
  // No resetDate = quota not loaded (or the query failed): say nothing rather
  // than a "1 of 1 left" the server may contradict.
  if (quota.isPro || !quota.resetDate) return null;

  const text = quota.isExhausted
    ? t('diagnose.quotaUsed', { date: formatQuotaResetDate(quota.resetDate, i18n.language) })
    : t('diagnose.quotaRemaining', { count: quota.remaining, limit: quota.limit });

  return (
    <Text style={[type.caption, { color: theme.ink3, marginTop: space.xs, textAlign: 'center' }]}>
      {text}
    </Text>
  );
}
