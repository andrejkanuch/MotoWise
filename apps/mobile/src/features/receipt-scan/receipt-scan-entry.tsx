import { palette } from '@motovault/design-system';
import { type Href, useRouter } from 'expo-router';
import { ChevronRight, ScanLine, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MODAL_ROUTE } from '../../config/routes';
import { useProGate } from '../../hooks/use-pro-gate';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';
import type { ScanEntrySurface } from './scan-flow-constants';
import { RECEIPT_SCAN_LIMIT_KEY, useReceiptScanQuota } from './use-receipt-scan-quota';

interface ReceiptScanEntryProps {
  /** Bike context carried into the scan (pre-picks the bike). */
  motorcycleId?: string;
  /** Entry-point attribution surface. */
  surface: ScanEntrySurface;
  /** Optional enter-animation delay to stagger with surrounding cards. */
  delay?: number;
}

/**
 * Reusable "Scan a receipt" entry affordance (U8).
 *
 * Discovery surface for the receipt-scan feature on the home screen, bike hub and
 * empty states. It reads {@link useReceiptScanQuota}:
 *  - free with scans left → a "N free" badge, opens the scan flow (bike pre-picked);
 *  - free & exhausted → the badge becomes an upsell cue and the press routes to the
 *    paywall (deliberate supersession of the PRD's dead "0 free" badge);
 *  - Pro → no badge.
 *
 * Logging is never paywalled — this sells the metered *scan* convenience; the
 * manual-entry path stays co-equal everywhere this appears.
 */
export interface ReceiptScanEntryState {
  /** Opens the scan flow, or the paywall once the free scans are used up. */
  open: () => void;
  /** Free scans left this month; shown as "N free" beside the scan action. */
  remaining: number;
  /** Free with scans left: show the "N free" count. */
  showFreeBadge: boolean;
  /** Free and used up: the press leads to the upsell. */
  showUpsellBadge: boolean;
}

/**
 * The behaviour of the scan entry, shared by the banner below and by surfaces
 * that draw their own (the bike hub's quiet Costs row): quota state and the
 * press that opens the scan — or the paywall when the free scans are used up.
 */
export function useReceiptScanEntry({
  motorcycleId,
  surface,
}: Pick<ReceiptScanEntryProps, 'motorcycleId' | 'surface'>): ReceiptScanEntryState {
  const router = useRouter();
  const { requireAccess } = useProGate();
  const quota = useReceiptScanQuota();

  const open = () => {
    triggerImpact();
    // 0-state → paywall (upsell), never a dead modal. requireAccess presents the
    // RevenueCat paywall (and fires paywall_present_requested + paywall_viewed) and
    // returns false when exhausted; Pro / remaining > 0 returns true and proceeds.
    if (!requireAccess(RECEIPT_SCAN_LIMIT_KEY, quota.used)) return;
    router.push({
      pathname: MODAL_ROUTE.SCAN_RECEIPT,
      params: { ...(motorcycleId ? { motorcycleId } : {}), surface },
    } as Href);
  };

  return {
    open,
    remaining: quota.remaining,
    showFreeBadge: !quota.isPro && Number.isFinite(quota.remaining) && quota.remaining > 0,
    showUpsellBadge: !quota.isPro && quota.isExhausted,
  };
}

export function ReceiptScanEntry({ motorcycleId, surface, delay = 0 }: ReceiptScanEntryProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const {
    open: onPress,
    remaining,
    showFreeBadge,
    showUpsellBadge,
  } = useReceiptScanEntry({ motorcycleId, surface });

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(300)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('receiptScan.entry.title')}
        accessibilityHint={t('receiptScan.entry.subtitle')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: tint(palette.signature500, 0.1),
          borderWidth: 1,
          borderColor: tint(palette.signature500, 0.28),
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: tint(palette.signature500, 0.2),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ScanLine size={20} color={palette.signature500} strokeWidth={2} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.ink }} numberOfLines={1}>
            {t('receiptScan.entry.title')}
          </Text>
          <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 1 }} numberOfLines={1}>
            {t('receiptScan.entry.subtitle')}
          </Text>
        </View>

        {showFreeBadge && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: tint(palette.signature500, 0.16),
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.signature500 }}>
              {t('receiptScan.entry.freeBadge', { count: remaining })}
            </Text>
          </View>
        )}

        {showUpsellBadge && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: palette.signature500,
            }}
          >
            <Sparkles size={12} color={palette.white} strokeWidth={2.5} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.white }}>
              {t('receiptScan.entry.upsellBadge')}
            </Text>
          </View>
        )}

        {!showFreeBadge && !showUpsellBadge && (
          <ChevronRight size={18} color={theme.ink3} strokeWidth={2} />
        )}
      </Pressable>
    </Animated.View>
  );
}
