import { type Href, useRouter } from 'expo-router';
import { ChevronRight, ReceiptText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MODAL_ROUTE } from '../../config/routes';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { layout, space } from '../../theme/spacing';
import { type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { getParkedScans, useParkedScanCount } from './parked-scan-store';
import { SCAN_ENTRY_SURFACE, SCAN_RESUME_SOURCE } from './scan-flow-constants';

/**
 * Home recovery surface for receipt scans (U8).
 *
 * The GUARANTEED recovery path the U6 parked-scan notification deep-links to
 * (the notification only nudges; this card always shows the work waiting):
 * parked / completed-but-unreviewed scans ("Review later") → tap resumes
 * straight into review.
 *
 * A receipt that is already saved does NOT show here: the post-save snackbar
 * (`receipt-scan-save-snackbar.tsx`) offers Undo right after the save, and a
 * lingering "Saved to …" card on home only repeated what the rider just did.
 *
 * Renders nothing when no scan is waiting. Mounted near the top of the home feed.
 */
export function ReceiptScanRecoveryCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { t: theme } = useEditorialTheme();
  const parkedCount = useParkedScanCount();

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
        style={{ marginHorizontal: layout.screenGutter, marginBottom: space.sm }}
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
            backgroundColor: tint(theme.plateDue, 0.1),
            borderWidth: 1,
            borderColor: tint(theme.plateDue, 0.3),
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.plateDue, 0.2),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ReceiptText size={20} color={theme.dueInk} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...type.bodyStrong, color: theme.ink }} numberOfLines={1}>
              {t('receiptScan.recovery.reviewTitle', { count: parkedCount })}
            </Text>
            <Text style={{ ...type.caption, color: theme.ink3, marginTop: 1 }} numberOfLines={1}>
              {t('receiptScan.recovery.reviewSubtitle')}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    );
  }

  return null;
}
