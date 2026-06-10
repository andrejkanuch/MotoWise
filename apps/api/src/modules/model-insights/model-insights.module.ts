import { Module } from '@nestjs/common';
import { MotorcyclesModule } from '../motorcycles/motorcycles.module';
import { OemSchedulesModule } from '../oem-schedules/oem-schedules.module';
import { AI_INSIGHTS_PROVIDERS, type AiInsightsProvider } from './ai-provider.interface';
import { ModelInsightsService } from './model-insights.service';
import { OnboardingRevealResolver } from './onboarding-reveal.resolver';
import { GeminiInsightsProvider } from './providers/gemini.provider';
import { OpenAiInsightsProvider } from './providers/openai.provider';
import { StaticInsightsProvider } from './providers/static.provider';

/**
 * AI personalization for the onboarding Reveal. Wires the failover chain in
 * priority order — Gemini → OpenAI → static — behind a single token the
 * service iterates (all via the Vercel AI SDK). Providers self-report
 * availability, so an unconfigured key simply removes that link from the chain.
 */
@Module({
  imports: [MotorcyclesModule, OemSchedulesModule],
  providers: [
    GeminiInsightsProvider,
    OpenAiInsightsProvider,
    StaticInsightsProvider,
    {
      provide: AI_INSIGHTS_PROVIDERS,
      inject: [GeminiInsightsProvider, OpenAiInsightsProvider, StaticInsightsProvider],
      useFactory: (
        gemini: GeminiInsightsProvider,
        openai: OpenAiInsightsProvider,
        staticProvider: StaticInsightsProvider,
      ): AiInsightsProvider[] => [gemini, openai, staticProvider],
    },
    ModelInsightsService,
    OnboardingRevealResolver,
  ],
  exports: [ModelInsightsService],
})
export class ModelInsightsModule {}
