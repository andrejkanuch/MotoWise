import { ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useReceiptScanEntry } from '../../../features/receipt-scan/receipt-scan-entry';
import { SCAN_ENTRY_SURFACE } from '../../../features/receipt-scan/scan-flow-constants';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { useEditorialTheme } from '../../../theme/editorial';
import { ExpensesSection } from '../expenses-section';
import type { HubBike } from '../shell/use-bike-hub-data';
import { HubCard } from '../ui/hub-card';
import { RowBody } from '../ui/list-row';
import { RowChevron } from '../ui/row-chevron';
import { HUB_FONT, hub } from '../ui/tokens';

interface CostsSegmentProps {
  bike: HubBike;
  unit: HubUnit;
}

/**
 * The scan-a-receipt entry as one quiet hub row: a neutral tile, the action as
 * the title, and the free-scan count beside the chevron — the quota sits next
 * to the scan action instead of headlining a copper banner. Copper stays with
 * the action pill. Same behaviour as the banner elsewhere (`useReceiptScanEntry`):
 * free scans open the scan, an exhausted quota opens the upsell.
 */
function ReceiptScanRow({ motorcycleId }: { motorcycleId: string }) {
  const { t } = useTranslation();
  const scan = useReceiptScanEntry({ motorcycleId, surface: SCAN_ENTRY_SURFACE.BIKE_HUB });
  const quota = scan.showFreeBadge
    ? t('receiptScan.entry.freeBadge', { count: scan.remaining })
    : scan.showUpsellBadge
      ? t('receiptScan.entry.upsellBadge')
      : null;

  return (
    <HubCard
      testID="costs-scan-receipt"
      onPress={scan.open}
      accessibilityLabel={[t('receiptScan.entry.title'), quota].filter(Boolean).join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingLeft: 14,
        paddingRight: 12,
      }}
    >
      <RowBody
        icon={{ icon: ScanLine, color: hub.dim, background: hub.raised }}
        title={t('receiptScan.entry.title')}
        sub={t('receiptScan.entry.subtitle')}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {quota ? (
              <Text style={{ fontFamily: HUB_FONT.mono, fontSize: 12, color: hub.muted }}>
                {quota}
              </Text>
            ) : null}
            <RowChevron />
          </View>
        }
      />
    </HubCard>
  );
}

/**
 * Interim Costs segment (until R4): the expense list on the hub's system, with
 * the scan-a-receipt entry as a quiet row under the period summary. The scan
 * stays here because today's add-expense form has no scan entry of its own —
 * R4 moves it inside Add expense. Adding an expense is the action pill.
 */
export function CostsSegment({ bike, unit }: CostsSegmentProps) {
  const { isDark } = useEditorialTheme();
  return (
    <View style={{ paddingTop: 12, paddingBottom: 16 }}>
      <ExpensesSection
        motorcycleId={bike.id}
        isDark={isDark}
        currentMileage={bike.currentMileage ?? undefined}
        mileageUnit={unit}
        afterSummary={<ReceiptScanRow motorcycleId={bike.id} />}
      />
    </View>
  );
}
