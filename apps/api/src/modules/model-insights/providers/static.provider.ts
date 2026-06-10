import { type ModelInsightsPayload, ModelInsightsPayloadSchema } from '@motovault/types';
import { Injectable } from '@nestjs/common';
import type { AiInsightsProvider, ModelInsightsRequest } from '../ai-provider.interface';

/**
 * Final fallback in the failover chain. Never calls the network, never fails —
 * returns generic, hedged upkeep areas templated from the make. Guarantees the
 * Reveal always has *something* hedged to show (or the client hides the card),
 * so onboarding never blocks on AI.
 */
@Injectable()
export class StaticInsightsProvider implements AiInsightsProvider {
  readonly name = 'static';

  isAvailable(): boolean {
    return true;
  }

  generate(req: ModelInsightsRequest): Promise<ModelInsightsPayload> {
    const make = req.make.trim() || 'your bike';
    const payload: ModelInsightsPayload = {
      knownIssues: [
        {
          title: 'Chain & sprockets',
          detail: `Owners commonly report keeping an eye on chain tension and lubrication to get the most life out of their ${make}.`,
        },
        {
          title: 'Tyres & brakes',
          detail:
            'It is often noted that checking tyre wear and brake pads before longer rides pays off.',
        },
        {
          title: 'Fluids & filters',
          detail:
            'Some riders mention that staying ahead of oil and filter changes keeps things running smoothly.',
        },
      ],
    };
    // Validate our own output so the contract is identical to the AI providers.
    return Promise.resolve(ModelInsightsPayloadSchema.parse(payload));
  }
}
