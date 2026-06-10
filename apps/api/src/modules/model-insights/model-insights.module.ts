import { Module } from '@nestjs/common';
import { MotorcyclesModule } from '../motorcycles/motorcycles.module';
import { OemSchedulesModule } from '../oem-schedules/oem-schedules.module';
import { AI_INSIGHTS_PROVIDERS, type AiInsightsProvider } from './ai-provider.interface';
import { ModelInsightsService } from './model-insights.service';
import { OnboardingRevealResolver } from './onboarding-reveal.resolver';
import { AnthropicInsightsProvider } from './providers/anthropic.provider';
import { OpenAiInsightsProvider } from './providers/openai.provider';
import { StaticInsightsProvider } from './providers/static.provider';

/**
 * AI personalization for the onboarding Reveal. Wires the failover chain in
 * priority order — Claude → OpenAI → static — behind a single token the
 * service iterates. Providers self-report availability, so an unconfigured
 * key simply removes that link from the chain.
 */
@Module({
  imports: [MotorcyclesModule, OemSchedulesModule],
  providers: [
    AnthropicInsightsProvider,
    OpenAiInsightsProvider,
    StaticInsightsProvider,
    {
      provide: AI_INSIGHTS_PROVIDERS,
      inject: [AnthropicInsightsProvider, OpenAiInsightsProvider, StaticInsightsProvider],
      useFactory: (
        anthropic: AnthropicInsightsProvider,
        openai: OpenAiInsightsProvider,
        staticProvider: StaticInsightsProvider,
      ): AiInsightsProvider[] => [anthropic, openai, staticProvider],
    },
    ModelInsightsService,
    OnboardingRevealResolver,
  ],
  exports: [ModelInsightsService],
})
export class ModelInsightsModule {}
