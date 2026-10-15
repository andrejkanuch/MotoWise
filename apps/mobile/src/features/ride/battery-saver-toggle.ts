/**
 * The ride HUD's battery-saver switch.
 *
 * Applying a profile is a permission check plus a native stop and start, so it
 * takes a moment. Two rules keep the switch and the GPS profile in step:
 *
 * - One switch at a time. A second tap while one is applying is ignored. Before
 *   this guard, a gloved double-tap sent the same request twice and the store's
 *   relative flip ran twice, leaving the HUD showing OFF over a Balanced profile.
 * - Commit the requested value, and only once it is applied. A refused or
 *   failed switch (permission revoked mid-ride, Sentry MOTO-VAULT-REACT-NATIVE-3X)
 *   leaves the stored value alone.
 */
export interface BatterySaverToggleDeps {
  /** Applies the profile natively; resolves whether it is now in effect. */
  apply: (enabled: boolean) => Promise<boolean>;
  /** Stores the value that is now in effect. */
  commit: (enabled: boolean) => void;
  /** Reports a switch that threw. */
  report: (error: unknown) => void;
}

/** Returns the tap handler; it resolves once the switch has settled. */
export function createBatterySaverToggle({ apply, commit, report }: BatterySaverToggleDeps) {
  let applying = false;

  return async (enabled: boolean): Promise<void> => {
    if (applying) return;
    applying = true;
    try {
      if (await apply(enabled)) commit(enabled);
    } catch (error) {
      report(error);
    } finally {
      applying = false;
    }
  };
}
