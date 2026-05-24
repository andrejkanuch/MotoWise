import { Share } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { formatDistance, formatDuration } from '../../utils/ride-formatters';
import type { MeasurementSystem } from '@motovault/types';

interface ShareRideParams {
  rideId: string;
  rideName?: string | null;
  distanceM: number;
  durationS: number;
  bikeName?: string | null;
  system: MeasurementSystem;
}

/**
 * Share a ride via the native share sheet.
 *
 * Phase 0.5: text + URL only. No max speed or lean angle on the card
 * (safety/legal concern + lean angle policy).
 *
 * Phase 1.5 will add: react-native-view-shot image capture,
 * multi-card sheet, IG Story / WhatsApp deep links.
 */
export async function shareRide({
  rideId,
  rideName,
  distanceM,
  durationS,
  bikeName,
  system,
}: ShareRideParams): Promise<boolean> {
  const dist = formatDistance(distanceM, system);
  const dur = formatDuration(durationS);
  const name = rideName || 'My Ride';
  const bikeStr = bikeName ? ` on ${bikeName}` : '';

  const message = `${name} — ${dist} in ${dur}${bikeStr}\n\nTracked with MotoVault 🏍️`;

  try {
    trackEvent(AnalyticsEvent.SHARE_CARD_GENERATED, { rideId });

    const result = await Share.share({ message });

    if (result.action === Share.sharedAction) {
      trackEvent(AnalyticsEvent.SHARE_COMPLETED, {
        rideId,
        target: 'native_sheet',
      });
      return true;
    }
    return false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    trackEvent(AnalyticsEvent.SHARE_CARD_FAILED, { rideId, error: msg });
    return false;
  }
}
