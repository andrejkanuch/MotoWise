import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ModelInsightsPayload } from '@motovault/types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiInsightsProvider, ModelInsightsRequest } from '../ai-provider.interface';
import { generateInsightsWith } from './generate-insights';

/** Default Gemini model — fast/cheap tier; overridable via env. */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Primary provider — Google Gemini via the Vercel AI SDK. Available only when
 * GOOGLE_GENERATIVE_AI_API_KEY is set; otherwise the chain skips to OpenAI.
 */
@Injectable()
export class GeminiInsightsProvider implements AiInsightsProvider {
  readonly name = 'gemini';
  private readonly model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null;

  constructor(configService: ConfigService) {
    const apiKey =
      configService.get<string>('GOOGLE_GENERATIVE_AI_API_KEY') ??
      configService.get<string>('GEMINI_API_KEY');
    const modelId = configService.get<string>('AI_INSIGHTS_GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
    this.model = apiKey ? createGoogleGenerativeAI({ apiKey })(modelId) : null;
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  generate(req: ModelInsightsRequest, timeoutMs: number): Promise<ModelInsightsPayload> {
    if (!this.model) throw new Error('Gemini provider not configured');
    return generateInsightsWith(this.model, req, timeoutMs);
  }
}
