import { z } from 'zod';

/**
 * AI-authored model insights for the onboarding Reveal ("Bike Dossier").
 *
 * This is the ONLY AI-generated content in the Reveal — it is FLAVOR, not fact.
 * Authoritative facts (recalls, specs, OEM intervals, projected cost) come from
 * NHTSA / our data and are assembled separately in the resolver; they never
 * pass through an LLM. Every bullet here must be hedged ("owners commonly
 * report…") and is rendered as such on the client.
 *
 * Schema-invalid output = generation failure → the provider failover chain
 * falls through to the next provider, and ultimately to a static template.
 *
 * Kept compatible with OpenAI structured outputs (`zodResponseFormat`) and
 * Anthropic `zodOutputFormat`: only `.describe()` is used (no `.optional()`,
 * `.refine()`, `.record()`); the exact-3 constraint is enforced in the service.
 */
export const ModelInsightsKnownIssueSchema = z.object({
  title: z
    .string()
    .describe('Short label for the area owners watch, e.g. "Chain & sprockets" (max ~4 words)'),
  detail: z
    .string()
    .describe(
      'One hedged, non-authoritative sentence. MUST begin with a hedge such as "Owners commonly report", "Some riders mention", or "It is often noted". Never state a recall, a safety defect, or a definitive mechanical fact.',
    ),
});
export type ModelInsightsKnownIssue = z.infer<typeof ModelInsightsKnownIssueSchema>;

export const ModelInsightsPayloadSchema = z.object({
  knownIssues: z
    .array(ModelInsightsKnownIssueSchema)
    .describe('Exactly 3 things owners of this model commonly keep an eye on. Hedged, friendly.'),
});
export type ModelInsightsPayload = z.infer<typeof ModelInsightsPayloadSchema>;

/** Generation status as stored in `model_insights.status`. */
export const ModelInsightsStatus = {
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
} as const;
export type ModelInsightsStatus = (typeof ModelInsightsStatus)[keyof typeof ModelInsightsStatus];
