import { z } from 'zod';

// Shared maintenance-narrative contract (plan U5 / KTD 5). Lives in @motovault/types so BOTH
// the API narrative generator (article-generator.service.ts) and the web build-time MDX
// generator (apps/web/scripts/generate-maintenance-article.ts) enforce the identical no-digit
// rule and schema — the digit guard then runs at the web write boundary, not just at generation.

/** Matches any decimal digit (Unicode-aware). The single source of truth for the no-digit rule. */
const DIGIT_PATTERN = /\d/u;

/**
 * Pure predicate: true when `value` is safe to use as maintenance-narrative prose — i.e. it
 * contains NO standalone digit. Allowlist (digit-free passes), not a unit denylist, because a
 * denylist cannot enumerate every numeric form (`10W-30`, `4.8 L`, `3.4 quarts`, `every 16,000
 * km`, `8,000-mile interval`, `0.20–0.24 mm`, `kPa`, `34 Nm`, `2 years`, …). Any digit = rejected.
 */
export function isDigitFreeNarrative(value: string): boolean {
  return !DIGIT_PATTERN.test(value);
}

/**
 * Walks every string field of a narrative payload and returns the dotted paths of fields that
 * contain a digit. Empty array = clean. Recursion covers nested arrays/objects (sections,
 * key takeaways), not just the top level.
 */
export function findDigitViolations(payload: unknown, path = ''): string[] {
  if (typeof payload === 'string') {
    return isDigitFreeNarrative(payload) ? [] : [path || '(root)'];
  }
  if (Array.isArray(payload)) {
    return payload.flatMap((item, i) => findDigitViolations(item, `${path}[${i}]`));
  }
  if (payload && typeof payload === 'object') {
    return Object.entries(payload).flatMap(([key, val]) =>
      findDigitViolations(val, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

// Narrative-only schema: PROSE sections, key takeaways, intro — and NO numeric/interval fields
// (KTD 5). zodResponseFormat-compatible (no .optional()/.refine()). The digit guard runs AFTER
// parsing (not as a Zod refinement) so it can be unit-tested as a pure function reporting field paths.
export const MaintenanceNarrativeSchema = z.object({
  intro: z
    .string()
    .describe(
      'Opening prose for a motorcycle maintenance article. Mention NO numbers — refer to schedules generically (e.g. "see the schedule below").',
    ),
  diyVsDealer: z
    .string()
    .describe('Prose comparing DIY vs dealer servicing. NO numbers, costs, intervals, or units.'),
  ownershipNotes: z
    .string()
    .describe('Prose on living with and caring for the bike. NO numbers of any kind.'),
  sections: z
    .array(
      z.object({
        heading: z.string().describe('Section heading — NO numbers.'),
        body: z.string().describe('Section body prose — NO numbers, intervals, or units.'),
      }),
    )
    .describe('2-4 additional prose sections, no numbers anywhere.'),
  keyTakeaways: z.array(z.string()).describe('3-5 takeaways as prose — NO numbers.'),
});

export type MaintenanceNarrative = z.infer<typeof MaintenanceNarrativeSchema>;
