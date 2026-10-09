import { radii, spacing } from '@motovault/design-system';
import type { HealthReportStatus } from '@motovault/graphql';
import { AlertTriangle, CheckCircle, Clock, Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';

interface HealthReportCardProps {
  id: string;
  status: HealthReportStatus;
  pdfUrl?: string | null;
  createdAt: string;
  index?: number;
  onRetry?: () => void;
}

type ThemeTokens = ReturnType<typeof useEditorialTheme>['t'];

/** Status → tone. Tints are derived from the tone so no colour literal lives here. */
const STATUS_TONE: Record<HealthReportStatus, (t: ThemeTokens) => string> = {
  completed: (t) => t.success,
  pending: (t) => t.plateDue,
  failed: (t) => t.danger,
};

function StatusIcon({ status, color }: { status: HealthReportStatus; color: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={18} color={color} strokeWidth={2} />;
    case 'pending':
      return <Clock size={18} color={color} strokeWidth={2} />;
    case 'failed':
      return <AlertTriangle size={18} color={color} strokeWidth={2} />;
    default:
      return <Clock size={18} color={color} strokeWidth={2} />;
  }
}

export function HealthReportCard({
  status,
  pdfUrl,
  createdAt,
  index = 0,
  onRetry,
}: HealthReportCardProps) {
  const { t } = useTranslation();
  const { t: tokens } = useEditorialTheme();
  const tone = (STATUS_TONE[status] ?? STATUS_TONE.pending)(tokens);
  const theme = { bg: tint(tone, 0.1), border: tint(tone, 0.15), iconColor: tone };
  const textPrimary = tokens.ink;
  const textSecondary = tokens.ink3;

  const handlePress = async () => {
    if (status === 'completed' && pdfUrl) {
      triggerImpact();
      await Linking.openURL(pdfUrl);
    } else if (status === 'failed' && onRetry) {
      triggerImpact();
      onRetry();
    }
  };

  const statusLabel =
    status === 'completed'
      ? t('healthReport.statusCompleted')
      : status === 'pending'
        ? t('healthReport.statusPending')
        : t('healthReport.statusFailed');

  const dateStr = new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
      <Pressable
        onPress={handlePress}
        disabled={status === 'pending'}
        accessibilityRole="button"
        accessibilityLabel={`${t('healthReport.title')} — ${statusLabel}`}
        style={({ pressed }) => ({
          opacity: pressed && status !== 'pending' ? 0.9 : 1,
          transform: [{ scale: pressed && status !== 'pending' ? 0.98 : 1 }],
        })}
      >
        <View
          style={{
            backgroundColor: theme.bg,
            borderRadius: 16,
            padding: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[3],
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: tint(theme.iconColor, 0.1),
              alignItems: 'center',
              justifyContent: 'center',
              borderCurve: 'continuous',
            }}
          >
            <StatusIcon status={status} color={theme.iconColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: textPrimary,
              }}
            >
              {statusLabel}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: textSecondary,
                marginTop: 2,
              }}
            >
              {dateStr}
            </Text>
          </View>

          {status === 'completed' && pdfUrl && (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radii.button,
                backgroundColor: tint(tokens.warm, 0.1),
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}
            >
              <Download size={16} color={tokens.warm2} strokeWidth={2} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
