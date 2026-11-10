import { compareVersions, parseVersion } from '../version-compare';

describe('parseVersion', () => {
  it('reads three numeric segments', () => {
    expect(parseVersion('3.28.0')).toEqual([3, 28, 0]);
  });

  it('treats a missing patch (or minor) segment as 0', () => {
    expect(parseVersion('3.28')).toEqual([3, 28, 0]);
    expect(parseVersion('3')).toEqual([3, 0, 0]);
  });

  it.each([
    '',
    'abc',
    '3.28.x',
    '3.28.0-beta',
    '3..0',
    ' 3.28.0',
    '3.28.0.1',
    'v3.28.0',
  ])('returns null for junk %p', (junk) => {
    expect(parseVersion(junk)).toBeNull();
  });

  it('returns null for a missing version', () => {
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
});

describe('compareVersions', () => {
  it('compares segments numerically, not as strings', () => {
    expect(compareVersions('3.9.0', '3.10.0')).toBe(-1);
    expect(compareVersions('3.10.0', '3.9.0')).toBe(1);
  });

  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('4.0.0', '3.99.99')).toBe(1);
    expect(compareVersions('3.28.3', '3.28.0')).toBe(1);
    expect(compareVersions('3.28.0', '3.28.0')).toBe(0);
  });

  it('treats a missing patch as 0', () => {
    expect(compareVersions('3.28', '3.28.0')).toBe(0);
    expect(compareVersions('3.28', '3.28.1')).toBe(-1);
  });

  it('is not comparable when either side is junk', () => {
    expect(compareVersions('junk', '3.28.0')).toBeNull();
    expect(compareVersions('3.28.0', '')).toBeNull();
  });
});
