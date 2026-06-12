import { type ModelInsightsPayload, ModelInsightsPayloadSchema } from '@motovault/types';
import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import type { ModelInsightsRequest } from '../ai-provider.interface';
import { buildInsightsUserPrompt, INSIGHTS_SYSTEM_PROMPT } from '../insights-prompt';

/**
 * Shared structured-generation path for every AI provider (Gemini, OpenAI, …).
 * Uses the Vercel AI SDK's `generateObject`, which constrains the model to the
 * Zod schema and validates the result — schema-invalid output throws, so the
 * caller's failover chain falls through to the next provider. The per-call
 * timeout is enforced via an AbortSignal so a slow call fails fast inside the
 * day-0 budget.
 */
export async function generateInsightsWith(
  model: LanguageModel,
  req: ModelInsightsRequest,
  timeoutMs: number,
): Promise<ModelInsightsPayload> {
  const { object } = await generateObject({
    model,
    schema: ModelInsightsPayloadSchema,
    system: INSIGHTS_SYSTEM_PROMPT,
    prompt: buildInsightsUserPrompt(req),
    abortSignal: AbortSignal.timeout(timeoutMs),
  });
  return object;
}
