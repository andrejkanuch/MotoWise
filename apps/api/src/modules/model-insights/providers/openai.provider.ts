import { type ModelInsightsPayload, ModelInsightsPayloadSchema } from '@motovault/types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { AI_MODELS } from '../../../config/constants';
import type { AiInsightsProvider, ModelInsightsRequest } from '../ai-provider.interface';
import { buildInsightsUserPrompt, INSIGHTS_SYSTEM_PROMPT } from '../insights-prompt';

/** Secondary provider — reuses the existing OPENAI_API_KEY + structured outputs. */
@Injectable()
export class OpenAiInsightsProvider implements AiInsightsProvider {
  readonly name = 'openai';
  private readonly client: OpenAI | null;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('OPENAI_API_KEY');
    // maxRetries: 0 — the failover chain is our retry strategy; we want to fail
    // fast to the next provider rather than burn the tight per-call budget.
    this.client = apiKey ? new OpenAI({ apiKey, maxRetries: 0 }) : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generate(req: ModelInsightsRequest, timeoutMs: number): Promise<ModelInsightsPayload> {
    if (!this.client) throw new Error('OpenAI provider not configured');

    const completion = await this.client.chat.completions.parse(
      {
        model: AI_MODELS.INSIGHTS,
        messages: [
          { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
          { role: 'user', content: buildInsightsUserPrompt(req) },
        ],
        response_format: zodResponseFormat(ModelInsightsPayloadSchema, 'model_insights'),
        max_tokens: 512,
      },
      { timeout: timeoutMs },
    );

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      const refusal = completion.choices[0]?.message.refusal;
      throw new Error(refusal ? `OpenAI refused: ${refusal}` : 'OpenAI returned no parsed output');
    }
    return parsed;
  }
}
