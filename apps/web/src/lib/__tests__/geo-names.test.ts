import { describe, expect, it } from 'vitest';
import { countryDisplayName, regionDisplayName } from '../geo-names';

describe('countryDisplayName', () => {
  it('prefers the curated map (overrides ICU naming)', () => {
    expect(countryDisplayName('cz')).toBe('Czech Republic'); // ICU would say "Czechia"
    expect(countryDisplayName('us')).toBe('United States');
  });

  it('falls back to ICU for valid codes outside the curated map', () => {
    // Countries with published trips but no COUNTRY_NAMES entry (Sentry MOTOVAULT-WEB-R).
    expect(countryDisplayName('pe')).toBe('Peru');
    expect(countryDisplayName('ec')).toBe('Ecuador');
    expect(countryDisplayName('nl')).toBe('Netherlands');
    expect(countryDisplayName('sg')).toBe('Singapore');
  });

  it('title-cases unassigned or non-alpha-2 input as a last resort', () => {
    expect(countryDisplayName('zz')).toBe('Zz');
    expect(countryDisplayName('not-a-code')).toBe('Not A Code');
  });
});

describe('regionDisplayName', () => {
  it('resolves mapped regions within a country', () => {
    expect(regionDisplayName('us', 'ca')).toBe('California');
    expect(regionDisplayName('ca', 'bc')).toBe('British Columbia');
  });

  it('title-cases unmapped regions', () => {
    expect(regionDisplayName('jp', 'kanto')).toBe('Kanto');
  });
});
