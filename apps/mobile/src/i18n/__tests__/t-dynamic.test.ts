jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import i18n from '..';
import { tDynamic } from '../t-dynamic';

describe('tDynamic', () => {
  it('translates a key that exists exactly as t() does', () => {
    expect(tDynamic(i18n.t, 'common.error')).toBe(i18n.t('common.error'));
    expect(tDynamic(i18n.t, 'common.error')).not.toBe('common.error');
  });

  it('passes interpolation options through', () => {
    const translated = tDynamic(i18n.t, 'auth.codeResendIn', { seconds: 45 });
    expect(translated).toBe(i18n.t('auth.codeResendIn', { seconds: 45 }));
    expect(translated).toContain('45');
    expect(translated).not.toContain('{{');
  });

  it('returns what t() returns for an unknown key', () => {
    const key = 'nope.notAKey';
    expect(tDynamic(i18n.t, key)).toBe(i18n.t(key as never));
  });
});
