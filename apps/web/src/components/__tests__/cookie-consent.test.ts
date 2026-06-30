// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// Sentry MOTOVAULT-WEB-T: in private mode / blocked-storage, PostHog's consent
// calls (set_config, opt_in/out_capturing) touch localStorage/cookies and throw
// a SecurityError (DOMException 18) as an unhandled rejection. applyPostHogConsent
// must swallow these so consent toggling never crashes the page.

const setConfig = vi.fn();
const optIn = vi.fn();
const optOut = vi.fn();
const capture = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    set_config: (...args: unknown[]) => setConfig(...args),
    opt_in_capturing: (...args: unknown[]) => optIn(...args),
    opt_out_capturing: (...args: unknown[]) => optOut(...args),
    capture: (...args: unknown[]) => capture(...args),
  },
}));

const securityError = () => {
  throw new DOMException('The request was denied.', 'SecurityError');
};

import { applyPostHogConsent } from '../cookie-consent';

afterEach(() => {
  // resetAllMocks (not clearAllMocks) so a securityError implementation set by
  // one test does not leak into the next.
  vi.resetAllMocks();
});

describe('applyPostHogConsent (Sentry MOTOVAULT-WEB-T regression guard)', () => {
  it('does not re-throw when granting consent and storage is blocked', () => {
    setConfig.mockImplementation(securityError);
    optIn.mockImplementation(securityError);
    expect(() => applyPostHogConsent(true)).not.toThrow();
  });

  it('does not re-throw when rejecting consent and storage is blocked', () => {
    optOut.mockImplementation(securityError);
    expect(() => applyPostHogConsent(false)).not.toThrow();
  });

  it('opts in and records consent when granted and storage works', () => {
    applyPostHogConsent(true);
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$consent_granted');
    expect(optOut).not.toHaveBeenCalled();
  });

  it('opts out when consent is rejected', () => {
    applyPostHogConsent(false);
    expect(optOut).toHaveBeenCalledTimes(1);
    expect(optIn).not.toHaveBeenCalled();
  });
});
