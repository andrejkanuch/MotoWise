import { canCheckRecalls } from '../recall-eligibility';

describe('canCheckRecalls', () => {
  it.each([
    ['make, model and year', { make: 'Honda', model: 'CRF1100', year: 2022, vin: null }, true],
    ['a VIN alone', { make: null, model: null, year: null, vin: 'JH2SC0000NK000000' }, true],
    [
      'a make-only bike with a VIN',
      { make: 'Honda', model: '', year: null, vin: 'JH2SC0000' },
      true,
    ],
    ['a make-only bike', { make: 'Honda', model: null, year: null, vin: null }, false],
    ['no year', { make: 'Honda', model: 'CRF1100', year: null, vin: null }, false],
    ['a blank model', { make: 'Honda', model: '   ', year: 2022, vin: '' }, false],
    ['a blank VIN and no make', { make: null, model: 'CRF1100', year: 2022, vin: '  ' }, false],
  ])('%s → %s', (_label, bike, expected) => {
    expect(canCheckRecalls(bike)).toBe(expected);
  });
});
