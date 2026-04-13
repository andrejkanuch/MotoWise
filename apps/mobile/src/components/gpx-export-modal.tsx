import { palette } from '@motovault/design-system';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Download, Lock } from 'lucide-react-native';
import { memo } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useGpxExport } from '../hooks/use-gpx-export';
import { useProGate } from '../hooks/useProGate';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

interface GpxExportModalProps {
  visible: boolean;
  routeId: string;
  routeName?: string;
  onClose: () => void;
}

export const GpxExportModal = memo(function GpxExportModal({
  visible,
  routeId,
  routeName,
  onClose,
}: GpxExportModalProps) {
  const isDark = useColorScheme() === 'dark';
  const { exportAndShare, isExporting } = useGpxExport();
  const { isPro, requirePro } = useProGate();

  const bg = isDark ? palette.cardDark : palette.white;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;

  // Fetch quota status (only relevant for free-tier users)
  const { data: quotaData, isLoading: quotaLoading } = useQuery({
    queryKey: queryKeys.routes.gpxQuota,
    queryFn: async () => {
      const { GetGpxQuotaStatusDocument } = await import('@motovault/graphql');
      return gqlFetcher(GetGpxQuotaStatusDocument);
    },
    enabled: visible && !isPro,
    staleTime: 30_000,
  });

  const quota = quotaData?.getGpxQuotaStatus;
  const quotaExhausted = !isPro && quota != null && quota.remaining <= 0;

  const handleExport = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Check quota for free-tier users
    if (!isPro && quotaExhausted) {
      requirePro('gpx_export');
      return;
    }

    await exportAndShare(routeId, routeName);
    onClose();
  };

  const formatResetDate = (isoDate: string) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            entering={FadeInUp.duration(250)}
            style={{
              backgroundColor: bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderCurve: 'continuous',
              padding: 24,
              paddingBottom: 40,
              gap: 16,
              alignItems: 'center',
            }}
          >
            {/* Handle indicator */}
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: isDark ? palette.neutral600 : palette.neutral300,
                marginBottom: 4,
              }}
            />

            {/* Icon */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {quotaExhausted ? (
                <Lock size={28} color={palette.accent500} />
              ) : (
                <Download size={28} color={palette.accent500} />
              )}
            </View>

            {/* Title */}
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: textColor,
                textAlign: 'center',
              }}
            >
              {quotaExhausted ? 'Export Limit Reached' : 'Export GPX'}
            </Text>

            {/* Quota status */}
            {quotaLoading ? (
              <ActivityIndicator size="small" color={palette.accent500} />
            ) : quota && !isPro ? (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    color: subtitleColor,
                    textAlign: 'center',
                  }}
                >
                  {quotaExhausted
                    ? `You've used all ${quota.limit} free exports this month. Upgrade to Pro for unlimited exports.`
                    : `${quota.remaining} of ${quota.limit} free exports remaining this month.`}
                </Text>
                {quota.resetsAt && (
                  <Text style={{ fontSize: 12, color: subtitleColor }}>
                    Resets {formatResetDate(quota.resetsAt)}
                  </Text>
                )}
              </View>
            ) : isPro ? (
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: subtitleColor,
                  textAlign: 'center',
                }}
              >
                Export this route as a GPX file and share it with any navigation app.
              </Text>
            ) : null}

            {/* CTA */}
            {quotaExhausted ? (
              <Pressable
                onPress={() => {
                  onClose();
                  requirePro('gpx_export');
                }}
                style={{
                  width: '100%',
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.accent500,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                  Upgrade to Pro
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleExport}
                disabled={isExporting || quotaLoading}
                style={{
                  width: '100%',
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: palette.accent500,
                  alignItems: 'center',
                  opacity: isExporting || quotaLoading ? 0.7 : 1,
                }}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                    Export & Share
                  </Text>
                )}
              </Pressable>
            )}

            {/* Cancel */}
            <Pressable onPress={onClose} style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: subtitleColor }}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
