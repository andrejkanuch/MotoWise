import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { type ModelInsightsPayload, ModelInsightsPayloadSchema } from '@motovault/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiInsightsProvider, ModelInsightsRequest } from '../ai-provider.interface';
import { buildInsightsUserPrompt, INSIGHTS_SYSTEM_PROMPT } from '../insights-prompt';

/** Default Claude model for insights — small/fast tier; overridable via env. */
const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Raw JSON Schema for the structured output. Hand-written (rather than derived
 * from the Zod schema) because the SDK's zod helper targets Zod v4 while the
 * monorepo is pinned to Zod v3 — the output is re-validated against the v3
 * ModelInsightsPayloadSchema below, so the contract is identical.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    knownIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['title', 'detail'],
        additionalProperties: false,
      },
    },
  },
  required: ['knownIssues'],
  additionalProperties: false,
} as const;

/**
 * Primary provider — Anthropic Claude via structured (Zod) output. Only
 * available when ANTHROPIC_API_KEY is set; otherwise the chain skips straight
 * to OpenAI. Per-call timeout is enforced via the SDK request option so a slow
 * call fails fast to the next provider inside the day-0 budget.
 */
@Injectable()
export class AnthropicInsightsProvider implements AiInsightsProvider {
  readonly name = 'claude';
  private readonly logger = new Logger(AnthropicInsightsProvider.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey, maxRetries: 0 }) : null;
    this.model = configService.get<string>('AI_INSIGHTS_CLAUDE_MODEL') ?? DEFAULT_CLAUDE_MODEL;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generate(req: ModelInsightsRequest, timeoutMs: number): Promise<ModelInsightsPayload> {
    if (!this.client) throw new Error('Anthropic provider not configured');

    const message = await this.client.messages.parse(
      {
        model: this.model,
        max_tokens: 512,
        system: INSIGHTS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildInsightsUserPrompt(req) }],
        output_config: { format: jsonSchemaOutputFormat(OUTPUT_SCHEMA) },
      },
      { timeout: timeoutMs },
    );

    if (!message.parsed_output) {
      throw new Error('Claude returned no parsed output');
    }
    // Re-validate against the canonical Zod (v3) schema — single source of truth.
    return ModelInsightsPayloadSchema.parse(message.parsed_output);
  }
}
