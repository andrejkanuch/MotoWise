import { canShowConsentPrompt } from '../consent-prompt';

describe('canShowConsentPrompt', () => {
  it.each([
    [['(onboarding)'], false],
    [['(onboarding)', 'index'], false],
    [['(onboarding)', 'experience'], true],
    [['(auth)', 'login'], true],
    [['(tabs)', '(garage)'], true],
    [['(modals)', 'ride-hud'], false],
    [['ride', '[id]'], false],
    [[], false],
  ])('%j -> %p', (segments, expected) => {
    expect(canShowConsentPrompt(segments)).toBe(expected);
  });
});
