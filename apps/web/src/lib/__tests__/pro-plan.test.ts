import { AI_FEATURE_LIMITS, FREE_TIER_LIMITS, GPX_EXPORT_LIMITS } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import {
  FREE_VS_PRO,
  PRO_BENEFIT_BULLETS,
  PRO_FEATURE_KEYS,
  PRO_FEATURES,
  UNLIMITED_LABEL,
} from '../pro-plan';

/**
 * Things that were once sold as Pro on the web but are free for everyone or do
 * not exist at all. None of them may come back as a Pro benefit.
 */
const BANNED_PRO_CLAIMS = [
  /analytics/i,
  /health report/i,
  /csv/i,
  /pdf/i,
  /priority support/i,
  /maintenance/i,
  /expense/i,
] as const;

function rowByName(name: string) {
  const row = FREE_VS_PRO.find((r) => r.name === name);
  if (!row) throw new Error(`missing comparison row: ${name}`);
  return row;
}

describe('pro-plan', () => {
  it('sells exactly the Pro features that are gated in code', () => {
    expect(PRO_FEATURES.map((f) => f.key)).toEqual(Object.values(PRO_FEATURE_KEYS));
  });

  it('never sells a free or non-existent feature as Pro', () => {
    for (const feature of PRO_FEATURES) {
      for (const banned of BANNED_PRO_CLAIMS) {
        expect(feature.title, `${feature.key} title`).not.toMatch(banned);
      }
    }
    for (const bullet of PRO_BENEFIT_BULLETS) {
      for (const banned of BANNED_PRO_CLAIMS) {
        expect(bullet).not.toMatch(banned);
      }
    }
  });

  it('keeps maintenance and expense logging free in the comparison table', () => {
    for (const name of ['Maintenance logging & reminders', 'Expense logging']) {
      expect(rowByName(name)).toMatchObject({ free: true, pro: true });
    }
  });

  it('marks only genuinely Pro-gated rows as unavailable on free', () => {
    const proOnly = FREE_VS_PRO.filter((r) => r.free === false).map((r) => r.name);
    expect(proOnly).toEqual(['Offline trip maps']);
  });

  it('takes free-tier numbers from the shared limits, not hardcoded copy', () => {
    expect(rowByName('Motorcycles in garage').free).toBe(String(FREE_TIER_LIMITS.MAX_BIKES));
    expect(rowByName('AI diagnostic scans').free).toBe(
      `${FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH} / month`,
    );
    expect(rowByName('AI articles').free).toBe(
      `${FREE_TIER_LIMITS.MAX_ARTICLES_PER_MONTH} / month`,
    );
    expect(rowByName('AI trip-assistant questions').free).toBe(
      `${AI_FEATURE_LIMITS.FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH} / month`,
    );
    expect(rowByName('AI ride summaries').free).toBe(
      `${AI_FEATURE_LIMITS.FREE_RIDE_SUMMARIES_PER_MONTH} / month`,
    );
    expect(rowByName('Receipt scans').free).toBe(
      `${FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH} / month`,
    );
    expect(rowByName('GPX export of trips').free).toBe(
      `${GPX_EXPORT_LIMITS.FREE_MONTHLY_EXPORTS} / month`,
    );
    expect(rowByName('Motorcycles in garage').pro).toBe(UNLIMITED_LABEL);
  });
});
