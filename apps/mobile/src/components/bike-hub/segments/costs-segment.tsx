import { View } from 'react-native';
import { ReceiptScanEntry } from '../../../features/receipt-scan/receipt-scan-entry';
import { SCAN_ENTRY_SURFACE } from '../../../features/receipt-scan/scan-flow-constants';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { useEditorialTheme } from '../../../theme/editorial';
import { ExpensesSection } from '../expenses-section';
import type { HubBike } from '../shell/use-bike-hub-data';

interface CostsSegmentProps {
  bike: HubBike;
  unit: HubUnit;
}

/**
 * Interim Costs segment (R1): today's `ExpensesSection`, unchanged. The
 * scan-a-receipt entry stays here because today's add-expense form has no scan
 * entry of its own — dropping the banner now would remove the bike-level scan.
 * R4 replaces the segment and moves the scan inside Add expense.
 */
export function CostsSegment({ bike, unit }: CostsSegmentProps) {
  const { isDark } = useEditorialTheme();
  return (
    <View style={{ paddingTop: 16, gap: 16 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <ReceiptScanEntry motorcycleId={bike.id} surface={SCAN_ENTRY_SURFACE.BIKE_HUB} />
      </View>
      <ExpensesSection
        motorcycleId={bike.id}
        isDark={isDark}
        currentMileage={bike.currentMileage ?? undefined}
        mileageUnit={unit}
      />
    </View>
  );
}
