import { palette } from '@motovault/design-system';
import { type Href, useRouter } from 'expo-router';
import { CheckCircle2, ChevronRight, ReceiptText, Undo2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MODAL_ROUTE } from '../../config/routes';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';
import { getParkedScans, useParkedScanCount } from './parked-scan-store';
import { clearReceiptSaveUndo, useLatestReceiptSaveUndo } from './receipt-scan-undo-store';
import { SCAN_ENTRY_SURFACE, SCAN_RESUME_SOURCE } from './scan-flow-constants';
import { useUndoReceiptSave } from './use-receipt-scan-save';

/**
 * Home recovery surface for receipt scans (U8).
 *
 * The GUARANTEED recovery path the U6 parked-scan notification deep-links to
 * (the notification only nudges; this card always shows the work waiting):
 *  1. Parked / completed-but-unreviewed scans → tap resumes straight into review.
 *  2. Otherwise, a still-fresh post-save undo entry → offer Undo past the toast.
 *
 * Renders nothing when there is neither. Mounted near the top of the home feed.
 */
export function ReceiptScanRecoveryCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { t: theme } = useEditorialTheme();
  const parkedCount = useParkedScanCount();
  const undoEntry = useLatestReceiptSaveUndo();
  const { undo, undoing } = useUndoReceiptSave();

  if (parkedCount > 0) {
    const openReview = () => {
      triggerImpact();
      // Resume the most-recent parked scan straight into the review card.
      const parked = getParkedScans();
      const scan = parked[parked.length - 1];
      if (!scan) return;
      // R8: the home recovery card is the user-initiated resume surface — tag the
      // source so it's separable from launch drain + notification recoveries.
      trackEvent(AnalyticsEvent.RECEIPT_SCAN_RESUMED, { source: SCAN_RESUME_SOURCE.CARD });
      router.push({
        pathname: MODAL_ROUTE.SCAN_RECEIPT,
        params: {
          resumeScanId: scan.scanId,
          ...(scan.bikeId ? { motorcycleId: scan.bikeId } : {}),
          surface: SCAN_ENTRY_SURFACE.HOME_RECOVERY_CARD,
        },
      } as Href);
    };

    return (
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={{ marginHorizontal: 20, marginBottom: 12 }}
      >
        <Pressable
          onPress={openReview}
          accessibilityRole="button"
          accessibilityLabel={t('receiptScan.recovery.reviewTitle', { count: parkedCount })}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 16,
            borderCurve: 'continuous',
            backgroundColor: tint(palette.warning500, 0.1),
            borderWidth: 1,
            borderColor: tint(palette.warning500, 0.3),
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: tint(palette.warning500, 0.2),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ReceiptText size={20} color={palette.warning500} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }} numberOfLines={1}>
              {t('receiptScan.recovery.reviewTitle', { count: parkedCount })}
            </Text>
            <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 1 }} numberOfLines={1}>
              {t('receiptScan.recovery.reviewSubtitle')}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    );
  }

  if (undoEntry) {
    return (
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={{ marginHorizontal: 20, marginBottom: 12 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 16,
            borderCurve: 'continuous',
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <CheckCircle2 size={20} color={palette.success500} strokeWidth={2} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.ink }} numberOfLines={1}>
              {t('receiptScan.saved.toast', { bike: undoEntry.bikeName })}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (undoing) return;
              triggerImpact();
              void undo(undoEntry);
            }}
            disabled={undoing}
            accessibilityRole="button"
            accessibilityLabel={t('receiptScan.saved.undo')}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: tint(palette.signature500, 0.12),
            }}
          >
            {undoing ? (
              <ActivityIndicator size="small" color={palette.signature500} />
            ) : (
              <Undo2 size={16} color={palette.signature500} strokeWidth={2.5} />
            )}
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.signature500 }}>
              {t('receiptScan.saved.undo')}
            </Text>
          </Pressable>
          {/* Non-destructive dismiss: the save is durable and the undo entry lives
              for SAVE_UNDO_TTL_MS (6h), so without this the card lingers on home
              with Undo (which rolls back the save) as the only way to clear it. */}
          <Pressable
            onPress={() => {
              triggerImpact();
              clearReceiptSaveUndo(undoEntry.scanId);
            }}
            disabled={undoing}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss', { defaultValue: 'Dismiss' })}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              borderCurve: 'continuous',
            }}
          >
            <X size={16} color={theme.ink3} strokeWidth={2.5} />
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return null;
}
