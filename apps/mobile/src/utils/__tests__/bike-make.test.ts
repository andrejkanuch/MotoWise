import { isValidMakeName, MIN_CUSTOM_MAKE_CHARS } from '../bike-make';

const KNOWN_MAKES = ['Honda', 'BMW', 'TM'];

describe('isValidMakeName', () => {
  it('rejects 1–2 character and blank free-typed makes', () => {
    expect(isValidMakeName('H', KNOWN_MAKES)).toBe(false);
    expect(isValidMakeName('ab', KNOWN_MAKES)).toBe(false);
    expect(isValidMakeName('  ', KNOWN_MAKES)).toBe(false);
    expect(isValidMakeName('', KNOWN_MAKES)).toBe(false);
  });

  it('counts only non-space characters toward the minimum', () => {
    expect(isValidMakeName(' a b ', KNOWN_MAKES)).toBe(false);
    expect(isValidMakeName('a b c', KNOWN_MAKES)).toBe(true);
  });

  it('accepts a make from the list, even one shorter than the free-typed minimum', () => {
    expect(isValidMakeName('Honda', KNOWN_MAKES)).toBe(true);
    expect(isValidMakeName('tm', KNOWN_MAKES)).toBe(true);
    expect(isValidMakeName(' bmw ', KNOWN_MAKES)).toBe(true);
  });

  it(`accepts a free-typed make of at least ${MIN_CUSTOM_MAKE_CHARS} characters`, () => {
    expect(isValidMakeName('Royal Enfield', KNOWN_MAKES)).toBe(true);
    expect(isValidMakeName('CCM', [])).toBe(true);
  });
});
