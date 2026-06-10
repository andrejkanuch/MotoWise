import type { ModelInsightsPayload } from '@motovault/types';

/** Inputs the AI needs to write known-issues copy. Y/M/M only — no PII. */
export interface ModelInsightsRequest {
  year: number;
  make: string;
  model: string;
}

/**
 * One link in the AI personalization failover chain. Providers are tried in
 * order (Claude → OpenAI → static); the first to return a Zod-valid payload
 * within the timeout wins. A provider that is not configured reports
 * `isAvailable() === false` and is skipped.
 */
export interface AiInsightsProvider {
  /** Stable id stored in `model_insights.source_model` (e.g. 'claude', 'openai', 'static'). */
  readonly name: string;
  /** False when the provider has no API key / SDK — the chain skips it. */
  isAvailable(): boolean;
  /**
   * Generate insights. MUST resolve within `timeoutMs` or reject. The returned
   * payload is Zod-validated by the caller; throwing (timeout, rate-limit,
   * invalid output) drops to the next provider.
   */
  generate(req: ModelInsightsRequest, timeoutMs: number): Promise<ModelInsightsPayload>;
}

export const AI_INSIGHTS_PROVIDERS = 'AI_INSIGHTS_PROVIDERS';
