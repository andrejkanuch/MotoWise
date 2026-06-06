import { APP_STATE_ACTIVE, shouldReportHydrationTimeout } from '../auth-hydration';

describe('shouldReportHydrationTimeout', () => {
  it('reports when still loading AND app is foregrounded (active)', () => {
    expect(shouldReportHydrationTimeout(true, APP_STATE_ACTIVE)).toBe(true);
  });

  it('does NOT report on a background launch — the timeout fired harmlessly', () => {
    // Sentry MOTO-VAULT-REACT-NATIVE-W: iOS throttles JS in the background so
    // getSession() can't resolve in wall-clock time. Not an actionable stall.
    expect(shouldReportHydrationTimeout(true, 'background')).toBe(false);
  });

  it('does NOT report when the app is inactive (transitioning)', () => {
    expect(shouldReportHydrationTimeout(true, 'inactive')).toBe(false);
  });

  it('does NOT report once hydration has completed, even in foreground', () => {
    expect(shouldReportHydrationTimeout(false, APP_STATE_ACTIVE)).toBe(false);
  });

  it('does NOT report when not loading and backgrounded', () => {
    expect(shouldReportHydrationTimeout(false, 'background')).toBe(false);
  });
});
