import { SUPPORTED_LOCALES } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import { resolveMaintenancePushCopy } from './maintenance-push-copy';

describe('resolveMaintenancePushCopy', () => {
  it('resolves an exact locale key', () => {
    expect(resolveMaintenancePushCopy('de').title).toBe('Wartung steht an');
  });

  it('resolves pt-BR regardless of case or separator', () => {
    // Regression: the lookup used to be case-sensitive, so pt-br/pt_BR fell through to English.
    for (const locale of ['pt-BR', 'pt-br', 'pt_BR', 'pt_br']) {
      expect(resolveMaintenancePushCopy(locale).title).toBe('Manutenção em breve');
    }
  });

  it('falls back to the base language for a region-qualified locale', () => {
    // en-US / en_GB → base 'en'
    expect(resolveMaintenancePushCopy('en-US').title).toBe('Maintenance due soon');
  });

  it('falls back to English for null/empty/unknown locales', () => {
    for (const locale of [null, undefined, '', 'xx-YY']) {
      expect(resolveMaintenancePushCopy(locale).title).toBe('Maintenance due soon');
    }
  });

  it('has dedicated copy for every supported locale (drift guard — no silent English fallback)', () => {
    // If a SUPPORTED_LOCALE is added without a COPY entry it would resolve to the English
    // default; assert each non-English locale resolves to its own copy so drift is caught.
    const englishTitle = resolveMaintenancePushCopy('en').title;
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue;
      expect(resolveMaintenancePushCopy(locale).title).not.toBe(englishTitle);
    }
  });
});

// #365 T07a: the per-bike reminder cap sends one push naming the count.
describe('MaintenancePushCopy.combinedBody', () => {
  it('names the count and the bike in English', () => {
    expect(resolveMaintenancePushCopy('en').combinedBody(3, 'MT-09')).toBe(
      '3 services due on your MT-09. Tap to review.',
    );
  });

  it('has a localized combined line for every supported locale', () => {
    const english = resolveMaintenancePushCopy('en').combinedBody(3, 'MT-09');
    for (const locale of SUPPORTED_LOCALES) {
      const body = resolveMaintenancePushCopy(locale).combinedBody(3, 'MT-09');
      expect(body).toContain('3');
      expect(body).toContain('MT-09');
      if (locale !== 'en') expect(body).not.toBe(english);
    }
  });
});
