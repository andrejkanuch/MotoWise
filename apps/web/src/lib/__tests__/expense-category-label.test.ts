import fs from 'node:fs';
import path from 'node:path';
import { EXPENSE_CATEGORY_META } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import { expenseCategoryMessageKey } from '../expense-category-label';

/**
 * Guard: every expense category in the shared enum has a translated label in
 * every web locale that ships a `Garage` section.
 *
 * Without it, a category added to EXPENSE_CATEGORY_META renders as the raw
 * message key on /garage (`Garage.catAccessories`, `Garage.catTaxes_fees` did).
 */

const MESSAGES_DIR = path.join(process.cwd(), 'messages');

const localesWithGarage = fs
  .readdirSync(MESSAGES_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({
    locale: file.replace(/\.json$/, ''),
    garage: (
      JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf8')) as {
        Garage?: Record<string, unknown>;
      }
    ).Garage,
  }))
  .filter((entry): entry is { locale: string; garage: Record<string, unknown> } =>
    Boolean(entry.garage),
  );

describe('expenseCategoryMessageKey', () => {
  it('camel-cases snake_case keys', () => {
    expect(expenseCategoryMessageKey('taxes_fees')).toBe('catTaxesFees');
    expect(expenseCategoryMessageKey('fuel')).toBe('catFuel');
  });
});

describe('expense category labels', () => {
  it('finds the web locales with a Garage section', () => {
    expect(localesWithGarage.map((l) => l.locale)).toContain('en');
    expect(localesWithGarage.length).toBeGreaterThanOrEqual(8);
  });

  for (const { locale, garage } of localesWithGarage) {
    it(`${locale} has a non-empty label for every shared expense category`, () => {
      const missing = EXPENSE_CATEGORY_META.map((m) => expenseCategoryMessageKey(m.key)).filter(
        (key) => typeof garage[key] !== 'string' || (garage[key] as string).trim() === '',
      );
      expect(missing).toEqual([]);
    });
  }
});
