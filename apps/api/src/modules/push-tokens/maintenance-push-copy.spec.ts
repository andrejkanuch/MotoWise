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
});
