import { decideAuthStateChange } from '../auth-state-change';

describe('decideAuthStateChange', () => {
  describe('session present', () => {
    it('identifies on first sign-in (prevUserId null → genuine change)', () => {
      const d = decideAuthStateChange({
        sessionUserId: 'user-1',
        prevUserId: null,
        hasPersistedUser: false,
      });
      expect(d.shouldIdentify).toBe(true);
      expect(d.shouldResetUser).toBe(false);
      expect(d.shouldClearLocalData).toBe(false);
    });

    it('does NOT re-identify on TOKEN_REFRESHED for the same user (todo 191)', () => {
      const d = decideAuthStateChange({
        sessionUserId: 'user-1',
        prevUserId: 'user-1',
        hasPersistedUser: true,
      });
      expect(d.shouldIdentify).toBe(false);
    });

    it('identifies when the user id actually changes (account switch)', () => {
      const d = decideAuthStateChange({
        sessionUserId: 'user-2',
        prevUserId: 'user-1',
        hasPersistedUser: true,
      });
      expect(d.shouldIdentify).toBe(true);
    });
  });

  describe('push token registration', () => {
    const decide = (sessionUserId: string | null, prevUserId: string | null) =>
      decideAuthStateChange({ sessionUserId, prevUserId, hasPersistedUser: prevUserId !== null })
        .shouldRegisterPush;

    it('registers when a session starts (cold start or first sign-in)', () => {
      expect(decide('user-1', null)).toBe(true);
    });

    it('registers again when the same rider signs back in after Log out', () => {
      // Log out removed the device's token: SIGNED_OUT sets prev to null first.
      expect(decide(null, 'user-1')).toBe(false);
      expect(decide('user-1', null)).toBe(true);
    });

    it('registers for a different account on the same device', () => {
      expect(decide('user-2', 'user-1')).toBe(true);
    });

    it('does not re-register on TOKEN_REFRESHED for the same user', () => {
      expect(decide('user-1', 'user-1')).toBe(false);
    });
  });

  describe('null session', () => {
    it('does NOT reset or clear on a genuine first-launch anonymous visitor (Defect 1)', () => {
      // Cold-start INITIAL_SESSION: no prior user in this session AND no
      // persisted user signal. Must not rotate the anonymous id.
      const d = decideAuthStateChange({
        sessionUserId: null,
        prevUserId: null,
        hasPersistedUser: false,
      });
      expect(d.shouldResetUser).toBe(false);
      expect(d.shouldClearLocalData).toBe(false);
      expect(d.shouldIdentify).toBe(false);
    });

    it('resets AND clears on an in-session sign-out (had a user this mount)', () => {
      const d = decideAuthStateChange({
        sessionUserId: null,
        prevUserId: 'user-1',
        hasPersistedUser: true,
      });
      expect(d.shouldResetUser).toBe(true);
      expect(d.shouldClearLocalData).toBe(true);
    });

    it('clears local data on a server-revoked cold start, but does NOT reset (todo 188)', () => {
      // Cold start: per-mount ref is null, but LAST_USER_KEY persists from a
      // prior session whose token was revoked server-side. Local cleanup must
      // run; resetUser stays gated on the per-mount ref to preserve Defect 1.
      const d = decideAuthStateChange({
        sessionUserId: null,
        prevUserId: null,
        hasPersistedUser: true,
      });
      expect(d.shouldClearLocalData).toBe(true);
      expect(d.shouldResetUser).toBe(false);
    });
  });
});
