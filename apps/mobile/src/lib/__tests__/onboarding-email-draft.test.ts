// issue 365 T13a (FS-OB3, ruling D10): the address a code went to and when,
// kept in one SecureStore key so a relaunch can reopen the code step. Never the
// password or the code.

const mockKeychain = new Map<string, string>();
jest.mock('../secure-store', () => ({
  SECURE_STORE_KEY: { ONBOARDING_EMAIL_DRAFT: 'motovault.onboarding-email-draft' },
  getSecureItem: jest.fn(async (key: string) => mockKeychain.get(key) ?? null),
  setSecureItem: jest.fn(async (key: string, value: string) => {
    mockKeychain.set(key, value);
    return true;
  }),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockKeychain.delete(key);
    return true;
  }),
}));

import {
  clearEmailDraft,
  EMAIL_DRAFT_RESTORE_WINDOW_MS,
  emailDraftAgeMs,
  isEmailDraftFresh,
  readEmailDraft,
  saveEmailDraft,
} from '../onboarding-email-draft';

const KEY = 'motovault.onboarding-email-draft';
const SENT_AT = Date.UTC(2026, 10, 14, 9, 0, 0);

beforeEach(() => {
  mockKeychain.clear();
});

describe('onboarding email draft', () => {
  it('saves the address and the send time, and reads them back', async () => {
    await saveEmailDraft({ email: 'rider@example.com', codeSentAt: SENT_AT });

    expect(await readEmailDraft()).toEqual({ email: 'rider@example.com', codeSentAt: SENT_AT });
  });

  it('stores exactly two fields: no password, no code', async () => {
    await saveEmailDraft({
      email: 'rider@example.com',
      codeSentAt: SENT_AT,
      // A caller passing more must not get it onto the keychain.
      ...({ password: 'hunter22', code: '123456' } as object),
    });

    const stored = JSON.parse(mockKeychain.get(KEY) ?? '{}');
    expect(Object.keys(stored).sort()).toEqual(['codeSentAt', 'email']);
  });

  it('clear removes the draft', async () => {
    await saveEmailDraft({ email: 'rider@example.com', codeSentAt: SENT_AT });

    await clearEmailDraft();

    expect(mockKeychain.has(KEY)).toBe(false);
    expect(await readEmailDraft()).toBeNull();
  });

  it('reads nothing when no draft exists or the stored value is not a draft', async () => {
    expect(await readEmailDraft()).toBeNull();

    mockKeychain.set(KEY, 'not json');
    expect(await readEmailDraft()).toBeNull();

    mockKeychain.set(KEY, JSON.stringify({ email: '', codeSentAt: SENT_AT }));
    expect(await readEmailDraft()).toBeNull();

    mockKeychain.set(KEY, JSON.stringify({ email: 'rider@example.com', codeSentAt: 'soon' }));
    expect(await readEmailDraft()).toBeNull();
  });

  it('is fresh for one hour after the code was sent, and stale after', () => {
    const draft = { email: 'rider@example.com', codeSentAt: SENT_AT };

    expect(EMAIL_DRAFT_RESTORE_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(isEmailDraftFresh(draft, SENT_AT + 59 * 60 * 1000)).toBe(true);
    expect(isEmailDraftFresh(draft, SENT_AT + EMAIL_DRAFT_RESTORE_WINDOW_MS)).toBe(true);
    expect(isEmailDraftFresh(draft, SENT_AT + EMAIL_DRAFT_RESTORE_WINDOW_MS + 1)).toBe(false);
    // A clock set back is never "older", but never a negative age either.
    expect(emailDraftAgeMs(draft, SENT_AT - 5_000)).toBe(0);
    expect(isEmailDraftFresh(draft, SENT_AT - 5_000)).toBe(true);
  });
});
