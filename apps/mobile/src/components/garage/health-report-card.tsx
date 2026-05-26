import { palette, radii, spacing } from '@motovault/design-system';
import type { HealthReportStatus } from '@motovault/graphql';
import { AlertTriangle, CheckCircle, Clock, Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { triggerImpact } from '../../utils/haptics';

interface HealthReportCardProps {
  id: string;
  status: HealthReportStatus;
  pdfUrl?: string | null;
  createdAt: string;
  index?: number;
  onRetry?: () => void;
}

const STATUS_CONFIG = {
  completed: {
    light: {
      bg: palette.successBgLight,
      iconColor: palette.success500,
      border: 'rgba(34,197,94,0.12)',
    },
    dark: {
      bg: palette.successBgDark,
      iconColor: '#4ade80',
      border: 'rgba(34,197,94,0.15)',
    },
  },
  pending: {
    light: {
      bg: palette.warningBgLight,
      iconColor: palette.warning500,
      border: 'rgba(245,158,11,0.12)',
    },
    dark: {
      bg: palette.warningBgDark,
      iconColor: '#fbbf24',
      border: 'rgba(245,158,11,0.15)',
    },
  },
  failed: {
    light: {
      bg: palette.dangerBgLight,
      iconColor: palette.danger500,
      border: 'rgba(239,68,68,0.12)',
    },
    dark: {
      bg: palette.dangerBgDark,
      iconColor: '#fca5a5',
      border: 'rgba(239,68,68,0.15)',
    },
  },
} as const;

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme =
    STATUS_CONFIG[status]?.[isDark ? 'dark' : 'light'] ??
    STATUS_CONFIG.pending[isDark ? 'dark' : 'light'];
  const textPrimary = isDark ? palette.neutral50 : palette.neutral950;
  const textSecondary = isDark ? palette.neutral400 : palette.neutral500;

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
              backgroundColor: `${theme.iconColor}18`,
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
                backgroundColor: `${palette.primary500}15`,
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}
            >
              <Download
                size={16}
                color={isDark ? palette.primary300 : palette.primary600}
                strokeWidth={2}
              />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
