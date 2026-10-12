import {
  buildFeedbackContact,
  initialContactEmailField,
  isRelayEmail,
  parseContactEmailField,
  readFeedbackContact,
} from '../contact-email';

const ACCOUNT = 'rider@gmail.com';

describe('isRelayEmail', () => {
  it.each([
    ['abc@privaterelay.appleid.com', true],
    ['ABC@PrivateRelay.AppleID.com', true],
    ['abc@private.icloud.com', true],
    ['rider@icloud.com', false],
    ['rider@gmail.com', false],
    [null, false],
  ])('%s → %s', (email, expected) => {
    expect(isRelayEmail(email)).toBe(expected);
  });
});

describe('initialContactEmailField', () => {
  it('prefers the stored contact email', () => {
    expect(initialContactEmailField(ACCOUNT, 'me@proton.me')).toBe('me@proton.me');
  });

  it('falls back to the account email', () => {
    expect(initialContactEmailField(ACCOUNT, null)).toBe(ACCOUNT);
  });

  it('starts empty for a relay account', () => {
    expect(initialContactEmailField('x@privaterelay.appleid.com', null)).toBe('');
  });
});

describe('parseContactEmailField', () => {
  it('empty means "use the account email"', () => {
    expect(parseContactEmailField('  ', ACCOUNT)).toEqual({ ok: true, email: null });
  });

  it('the account email itself is stored as null', () => {
    expect(parseContactEmailField(' Rider@Gmail.com ', ACCOUNT)).toEqual({ ok: true, email: null });
  });

  it('keeps a different address, trimmed', () => {
    expect(parseContactEmailField(' me@proton.me ', ACCOUNT)).toEqual({
      ok: true,
      email: 'me@proton.me',
    });
  });

  it.each([
    'not-an-email',
    'me@proton.me\r\nBcc: x@y.z',
    'me@proton.me\n',
  ])('rejects %j', (value) => {
    expect(parseContactEmailField(value, ACCOUNT)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('readFeedbackContact', () => {
  const contact = buildFeedbackContact({
    enabled: true,
    email: null,
    locale: 'de',
    source: 'notifications',
    now: new Date('2026-10-12T08:00:00.000Z'),
  });

  it('reads a stored opt-in', () => {
    expect(readFeedbackContact({ feedbackContact: contact })).toEqual({
      enabled: true,
      email: null,
      decidedAt: '2026-10-12T08:00:00.000Z',
      wordingVersion: 1,
      locale: 'de',
      source: 'notifications',
    });
  });

  it('is null when the rider never decided or the value is malformed', () => {
    expect(readFeedbackContact({})).toBeNull();
    expect(readFeedbackContact(null)).toBeNull();
    expect(readFeedbackContact({ feedbackContact: { enabled: 'yes' } })).toBeNull();
  });
});
