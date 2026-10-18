import {
  type Currency,
  isCurrency,
  isMeasurementSystem,
  type MeasurementSystem,
} from '@motovault/types';

interface DevicePreferences {
  currency: Currency;
  measurementSystem: MeasurementSystem;
}

/**
 * The account's currency and measurement system that differ from what this
 * device holds. The account wins: a rider who switched to imperial on another
 * device or on the web sees miles here too. Unknown or missing account values
 * are skipped, never applied.
 */
export function accountPreferenceUpdates(
  account: { currency?: string | null; measurementSystem?: string | null },
  device: DevicePreferences,
): Partial<DevicePreferences> {
  const updates: Partial<DevicePreferences> = {};
  if (isCurrency(account.currency) && account.currency !== device.currency) {
    updates.currency = account.currency;
  }
  if (
    isMeasurementSystem(account.measurementSystem) &&
    account.measurementSystem !== device.measurementSystem
  ) {
    updates.measurementSystem = account.measurementSystem;
  }
  return updates;
}
