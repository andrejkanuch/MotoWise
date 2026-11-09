import { useEffect } from 'react';
import { AppState } from 'react-native';
import { captureException } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { readPermissionLevel } from '../../utils/ride-permissions';
import { resumeRecoveredRide } from './ride-controller';

const APP_STATE_ACTIVE = 'active';

/**
 * While the open ride has lost location permission, restart recording as soon as
 * the rider comes back with it granted again (from Settings, via the HUD banner).
 * iOS stopped the update stream for good when access was revoked, so nothing
 * restarts it on its own; a successful restart clears the lost flag.
 */
export function useGpsPermissionRecovery(): void {
  const lost = useRideStore((s) => s.gpsPermissionLost);

  useEffect(() => {
    if (!lost) return;
    let inFlight = false;
    const recover = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        if ((await readPermissionLevel()) === 'denied') return;
        await resumeRecoveredRide();
      } catch (err) {
        captureException(err, { source: 'use-gps-permission-recovery' });
      } finally {
        inFlight = false;
      }
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === APP_STATE_ACTIVE) void recover();
    });
    return () => sub.remove();
  }, [lost]);
}
