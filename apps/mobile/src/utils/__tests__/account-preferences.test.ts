import { describe, expect, it } from '@jest/globals';
import { Currency, MeasurementSystem } from '@motovault/types';
import { accountPreferenceUpdates } from '../account-preferences';

const METRIC_EUR_DEVICE = {
  currency: Currency.EUR,
  measurementSystem: MeasurementSystem.METRIC,
};

describe('accountPreferenceUpdates', () => {
  it('applies an imperial account on a metric device', () => {
    expect(accountPreferenceUpdates({ measurementSystem: 'imperial' }, METRIC_EUR_DEVICE)).toEqual({
      measurementSystem: MeasurementSystem.IMPERIAL,
    });
  });

  it('applies a metric account on an imperial device', () => {
    expect(
      accountPreferenceUpdates(
        { measurementSystem: 'metric' },
        { ...METRIC_EUR_DEVICE, measurementSystem: MeasurementSystem.IMPERIAL },
      ),
    ).toEqual({ measurementSystem: MeasurementSystem.METRIC });
  });

  it('applies the account currency', () => {
    expect(accountPreferenceUpdates({ currency: 'USD' }, METRIC_EUR_DEVICE)).toEqual({
      currency: Currency.USD,
    });
  });

  it('changes nothing when the account matches the device', () => {
    expect(
      accountPreferenceUpdates({ currency: 'EUR', measurementSystem: 'metric' }, METRIC_EUR_DEVICE),
    ).toEqual({});
  });

  it('skips missing and unknown account values', () => {
    expect(
      accountPreferenceUpdates({ currency: null, measurementSystem: undefined }, METRIC_EUR_DEVICE),
    ).toEqual({});
    expect(
      accountPreferenceUpdates(
        { currency: 'XXX', measurementSystem: 'IMPERIAL' },
        METRIC_EUR_DEVICE,
      ),
    ).toEqual({});
  });
});
