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

import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  applyPostHogConsent,
  CookieConsentProvider,
  readExplicitConsent,
  useCookieConsent,
} from '../cookie-consent';

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

describe('readExplicitConsent', () => {
  const setCookie = (name: string, value: string) => {
    // biome-ignore lint/suspicious/noDocumentCookie: seeding test cookies
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
  };
  const clear = () => {
    for (const name of ['mv_consent', 'mv_region']) {
      // biome-ignore lint/suspicious/noDocumentCookie: test reset
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  };
  afterEach(clear);

  it('returns an explicit banner choice', () => {
    setCookie('mv_consent', 'v1:rejected:1790000000:EU:explicit');
    expect(readExplicitConsent()).toBe(false);
    setCookie('mv_consent', 'v1:accepted:1790000000:EU:explicit');
    expect(readExplicitConsent()).toBe(true);
  });

  it('returns null for the automatic grant outside the EU', () => {
    setCookie('mv_region', 'OTHER');
    setCookie('mv_consent', 'v1:accepted:1790000000:EU:implied');
    expect(readExplicitConsent()).toBeNull();
  });

  it('legacy cookies: a "no" is a choice; a "yes" only where the banner is shown', () => {
    setCookie('mv_region', 'OTHER');
    setCookie('mv_consent', 'v1:accepted:1790000000:EU');
    expect(readExplicitConsent()).toBeNull();
    setCookie('mv_consent', 'v1:rejected:1790000000:EU');
    expect(readExplicitConsent()).toBe(false);
    setCookie('mv_region', 'EU');
    setCookie('mv_consent', 'v1:accepted:1790000000:EU');
    expect(readExplicitConsent()).toBe(true);
  });

  it('returns null when nothing is decided', () => {
    expect(readExplicitConsent()).toBeNull();
  });

  it('the provider marks its automatic non-EU grant as implied, and a click as explicit', () => {
    // Vitest compiles the provider's JSX with the classic runtime (no Next here).
    Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
    setCookie('mv_region', 'OTHER');
    const probe: { api: ReturnType<typeof useCookieConsent> | null } = { api: null };
    const Probe = () => {
      probe.api = useCookieConsent();
      return null;
    };
    const root = createRoot(document.createElement('div'));
    act(() => root.render(createElement(CookieConsentProvider, null, createElement(Probe))));
    expect(probe.api?.consent).toBe(true);
    expect(readExplicitConsent()).toBeNull();

    act(() => probe.api?.deny());
    expect(readExplicitConsent()).toBe(false);
    act(() => root.unmount());
  });
});
