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
const register = vi.fn();
const setPersonProperties = vi.fn();
const getProperty = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    set_config: (...args: unknown[]) => setConfig(...args),
    opt_in_capturing: (...args: unknown[]) => optIn(...args),
    opt_out_capturing: (...args: unknown[]) => optOut(...args),
    capture: (...args: unknown[]) => capture(...args),
    register: (...args: unknown[]) => register(...args),
    setPersonProperties: (...args: unknown[]) => setPersonProperties(...args),
    get_property: (...args: unknown[]) => getProperty(...args),
  },
}));

const securityError = () => {
  throw new DOMException('The request was denied.', 'SecurityError');
};

import { applyPostHogConsent } from '../cookie-consent';

afterEach(() => {
  window.sessionStorage.clear();
  // biome-ignore lint/suspicious/noDocumentCookie: test reset of the attribution cookie
  document.cookie = 'mv_ft=; path=/; max-age=0';
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

  it('opts in and records consent when the visitor decides now', () => {
    applyPostHogConsent(true, { announce: true });
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$consent_granted');
    expect(optOut).not.toHaveBeenCalled();
  });

  it('does not re-send $consent_granted when re-applying a stored decision', () => {
    applyPostHogConsent(true);
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
  });

  it('hands the first touch to PostHog once, as super and set_once properties', () => {
    window.sessionStorage.setItem(
      'mv_campaign_params',
      JSON.stringify({ utm_source: 'instagram', utm_campaign: 'bio' }),
    );
    applyPostHogConsent(true);
    const props = { ft_utm_source: 'instagram', ft_utm_campaign: 'bio' };
    expect(register).toHaveBeenCalledWith({ ...props, ft_sent: true });
    expect(setPersonProperties).toHaveBeenCalledWith(undefined, props);
    expect(document.cookie).toContain('mv_ft=');

    getProperty.mockReturnValue(true);
    applyPostHogConsent(true);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('opts out and drops the attribution cookie when consent is rejected', () => {
    // biome-ignore lint/suspicious/noDocumentCookie: seeding the attribution cookie
    document.cookie = `mv_ft=${encodeURIComponent('{"utm_source":"tiktok"}')}; path=/`;
    applyPostHogConsent(false);
    expect(optOut).toHaveBeenCalledTimes(1);
    expect(optIn).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain('mv_ft=');
  });
});
