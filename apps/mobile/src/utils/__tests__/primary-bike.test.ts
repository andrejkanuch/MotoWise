import { selectPrimaryBike } from '../primary-bike';

const bike = (id: string, isPrimary: boolean) => ({ id, isPrimary });

describe('selectPrimaryBike', () => {
  it('returns the primary bike', () => {
    const bikes = [bike('a', false), bike('b', true), bike('c', false)];
    expect(selectPrimaryBike(bikes)).toBe(bikes[1]);
  });

  it('falls back to the first bike when none is primary', () => {
    const bikes = [bike('a', false), bike('b', false)];
    expect(selectPrimaryBike(bikes)).toBe(bikes[0]);
  });

  it('returns undefined for an empty list', () => {
    expect(selectPrimaryBike([])).toBeUndefined();
  });

  it('returns the first of two primary bikes', () => {
    const bikes = [bike('a', false), bike('b', true), bike('c', true)];
    expect(selectPrimaryBike(bikes)).toBe(bikes[1]);
  });
});
