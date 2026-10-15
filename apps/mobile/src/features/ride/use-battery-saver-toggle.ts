import { useCallback, useMemo } from 'react';
import { captureException } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { triggerImpact } from '../../utils/haptics';
import { toggleBatterySaver } from '../../utils/ride-location';
import { createBatterySaverToggle } from './battery-saver-toggle';

/**
 * The ride HUD's battery-saver tap handler. The toggle is built once per HUD so
 * its one-switch-at-a-time guard spans re-renders, and each tap reads the
 * current value from the store rather than a render's closure.
 */
export function useBatterySaverToggle(): () => void {
  const setBatterySaver = useRideStore((s) => s.setBatterySaver);

  const toggle = useMemo(
    () =>
      createBatterySaverToggle({
        apply: toggleBatterySaver,
        commit: setBatterySaver,
        report: (error) => captureException(error, { source: 'ride-hud.toggleBatterySaver' }),
      }),
    [setBatterySaver],
  );

  return useCallback(() => {
    triggerImpact();
    void toggle(!useRideStore.getState().isBatterySaver);
  }, [toggle]);
}
