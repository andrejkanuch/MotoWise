import { createOpenAI } from '@ai-sdk/openai';
import type { ModelInsightsPayload } from '@motovault/types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_MODELS } from '../../../config/constants';
import type { AiInsightsProvider, ModelInsightsRequest } from '../ai-provider.interface';
import { generateInsightsWith } from './generate-insights';

/**
 * Secondary provider — OpenAI via the Vercel AI SDK, reusing the existing
 * OPENAI_API_KEY. Runs after Gemini in the failover chain.
 */
@Injectable()
export class OpenAiInsightsProvider implements AiInsightsProvider {
  readonly name = 'openai';
  private readonly model: ReturnType<ReturnType<typeof createOpenAI>> | null;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('OPENAI_API_KEY');
    this.model = apiKey ? createOpenAI({ apiKey })(AI_MODELS.INSIGHTS) : null;
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  generate(req: ModelInsightsRequest, timeoutMs: number): Promise<ModelInsightsPayload> {
    if (!this.model) throw new Error('OpenAI provider not configured');
    return generateInsightsWith(this.model, req, timeoutMs);
  }
}
