import {
  AUTH_BLIP_GRACE_MS,
  createAuthBlipGuard,
  decideAuthStateChange,
} from '../auth-state-change';

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

// Issue 365 T15 (FS-PO12 / FS-PO13): a null session that is not an explicit
// sign-out, arriving after onboarding was completed, is a blip until proven
// otherwise. It must not route to (auth) (the gate reads `setSession(null)`) nor
// reset onboarding (`resetForSignOut` runs inside the local cleanup).
describe('session blip after onboarding completion (issue 365 T15)', () => {
  const blip = {
    sessionUserId: null,
    prevUserId: 'user-1',
    hasPersistedUser: true,
    onboardingCompleted: true,
    explicitSignOut: false,
  };

  describe('decideAuthStateChange', () => {
    it('defers a blip after completion: no reset, no local cleanup', () => {
      const d = decideAuthStateChange(blip);
      expect(d.shouldResetUser).toBe(false);
      expect(d.shouldClearLocalData).toBe(false);
      expect(d.shouldDeferNullSession).toBe(true);
    });

    it('applies an explicit sign-out immediately', () => {
      const d = decideAuthStateChange({ ...blip, explicitSignOut: true });
      expect(d.shouldDeferNullSession).toBe(false);
      expect(d.shouldResetUser).toBe(true);
      expect(d.shouldClearLocalData).toBe(true);
    });

    it('applies the null session once the grace window has run out (real revocation)', () => {
      const d = decideAuthStateChange({ ...blip, graceExpired: true });
      expect(d.shouldDeferNullSession).toBe(false);
      expect(d.shouldResetUser).toBe(true);
      expect(d.shouldClearLocalData).toBe(true);
    });

    it('does not defer before onboarding was completed', () => {
      const d = decideAuthStateChange({ ...blip, onboardingCompleted: false });
      expect(d.shouldDeferNullSession).toBe(false);
      expect(d.shouldClearLocalData).toBe(true);
    });

    it('does not defer a cold-start null session (no user in this app session)', () => {
      const d = decideAuthStateChange({ ...blip, prevUserId: null });
      expect(d.shouldDeferNullSession).toBe(false);
      expect(d.shouldClearLocalData).toBe(true);
    });
  });

  describe('createAuthBlipGuard', () => {
    type TestSession = { user: { id: string } };
    const session = (id: string): TestSession => ({ user: { id } });

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function setup({ completed = true, explicit = false } = {}) {
      const state = { completed, explicit };
      const apply = jest.fn();
      const onFlushError = jest.fn();
      const guard = createAuthBlipGuard<TestSession>({
        graceMs: AUTH_BLIP_GRACE_MS,
        shouldDeferNullSession: (prevUserId) =>
          decideAuthStateChange({
            sessionUserId: null,
            prevUserId,
            hasPersistedUser: true,
            onboardingCompleted: state.completed,
            explicitSignOut: state.explicit,
          }).shouldDeferNullSession,
        apply,
        onFlushError,
      });
      guard.handle('SIGNED_IN', session('user-1'));
      apply.mockClear();
      return { guard, apply, state, onFlushError };
    }

    const nullApplies = (apply: jest.Mock) => apply.mock.calls.filter(([, s]) => s === null);

    it('a blip followed by the same user never reaches setSession(null) or the reset', () => {
      const { guard, apply } = setup();
      guard.handle('SIGNED_OUT', null);
      expect(apply).not.toHaveBeenCalled();
      jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS - 1);
      guard.handle('TOKEN_REFRESHED', session('user-1'));
      jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS * 2);
      expect(nullApplies(apply)).toHaveLength(0);
      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith('TOKEN_REFRESHED', session('user-1'));
    });

    it('an explicit sign-out applies at once (security)', () => {
      const { guard, apply, state } = setup();
      state.explicit = true;
      guard.handle('SIGNED_OUT', null);
      expect(apply).toHaveBeenCalledWith('SIGNED_OUT', null);
    });

    it('an explicit sign-out during a pending blip applies at once', () => {
      const { guard, apply, state } = setup();
      guard.handle('SIGNED_OUT', null);
      state.explicit = true;
      guard.handle('SIGNED_OUT', null);
      expect(nullApplies(apply)).toHaveLength(1);
      jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS * 2);
      expect(nullApplies(apply)).toHaveLength(1);
    });

    it('a different user after a blip resets first, then signs the new user in', () => {
      const { guard, apply } = setup();
      guard.handle('SIGNED_OUT', null);
      guard.handle('SIGNED_IN', session('user-2'));
      expect(apply.mock.calls).toEqual([
        ['SIGNED_OUT', null],
        ['SIGNED_IN', session('user-2')],
      ]);
      jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS * 2);
      expect(apply).toHaveBeenCalledTimes(2);
    });

    it('a null session that never recovers is applied when the grace window ends', () => {
      const { guard, apply } = setup();
      guard.handle('SIGNED_OUT', null);
      jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS);
      expect(apply.mock.calls).toEqual([['SIGNED_OUT', null]]);
    });

    it('before onboarding completion a null session applies at once (unchanged)', () => {
      const { guard, apply } = setup({ completed: false });
      guard.handle('SIGNED_OUT', null);
      expect(apply).toHaveBeenCalledWith('SIGNED_OUT', null);
    });

    it('a throw while applying the held null on the timer is reported, not thrown', () => {
      const { guard, apply, onFlushError } = setup();
      const error = new Error('cleanup failed');
      apply.mockImplementationOnce(() => {
        throw error;
      });
      guard.handle('SIGNED_OUT', null);
      expect(() => jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS)).not.toThrow();
      expect(onFlushError).toHaveBeenCalledWith(error);
    });

    it('dispose cancels a pending grace timer', () => {
      const { guard, apply } = setup();
      guard.handle('SIGNED_OUT', null);
      guard.dispose();
      jest.advanceTimersByTime(AUTH_BLIP_GRACE_MS * 2);
      expect(apply).not.toHaveBeenCalled();
    });
  });
});
