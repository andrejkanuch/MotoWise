import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { ArticlesResolver } from '../../modules/articles/articles.resolver';
import { DiagnosticsResolver } from '../../modules/diagnostics/diagnostics.resolver';
import { InsightsResolver } from '../../modules/insights/insights.resolver';
import { ReceiptScanResolver } from '../../modules/receipt-scan/receipt-scan.resolver';
import { RideSummariesResolver } from '../../modules/ride-summaries/ride-summaries.resolver';
import { TripAssistantResolver } from '../../modules/trip-assistant/trip-assistant.resolver';
import { GqlThrottlerGuard } from './gql-throttler.guard';

/**
 * AI-throttle inventory (audit money guard).
 *
 * Every resolver method that triggers PAID AI generation must carry both
 * `@UseGuards(GqlThrottlerGuard)` and a `@Throttle({ default: ... })` preset, or
 * a single caller can run the AI spend up with no per-user rate limit (the global
 * spend cap is the only remaining backstop). This spec pins every such method so a
 * future edit that drops the guard/preset fails CI loudly.
 *
 * Metadata mechanism (verified empirically against @nestjs packages in this repo):
 *  - `@UseGuards(X)` sets `GUARDS_METADATA` ('__guards__') = [X] on the method, with
 *    the guard class identity preserved (we match by `.name`).
 *  - `@Throttle({ default: {...} })` sets `THROTTLER:TTLdefault` / `THROTTLER:LIMITdefault`
 *    keyed by the throttler name ('default') on the method.
 */
const THROTTLER_TTL_KEY = 'THROTTLER:TTLdefault';
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMITdefault';

// [resolver class, method name] for every paid-AI entry point.
const AI_METHODS: Array<[{ name: string; prototype: object }, string]> = [
  [ArticlesResolver, 'generateArticle'],
  [DiagnosticsResolver, 'submitDiagnostic'],
  [TripAssistantResolver, 'askTripAssistant'],
  [InsightsResolver, 'generateOnboardingInsights'],
  [RideSummariesResolver, 'regenerateRideSummary'],
  [ReceiptScanResolver, 'scanReceipt'],
];

describe('AI resolver throttle inventory', () => {
  const getMethod = (cls: { name: string; prototype: object }, name: string) => {
    const fn = (cls.prototype as Record<string, unknown>)[name];
    expect(fn, `${name} must exist on ${cls.name}`).toBeTypeOf('function');
    return fn as object;
  };

  for (const [Resolver, method] of AI_METHODS) {
    describe(`${Resolver.name}.${method}`, () => {
      it('is guarded by GqlThrottlerGuard (@UseGuards)', () => {
        const guards = (Reflect.getMetadata(GUARDS_METADATA, getMethod(Resolver, method)) ??
          []) as Array<{ name?: string }>;
        const names = guards.map((g) => g?.name);
        expect(names).toContain(GqlThrottlerGuard.name);
      });

      it('declares a @Throttle({ default }) preset (limit + ttl)', () => {
        const fn = getMethod(Resolver, method);
        const limit = Reflect.getMetadata(THROTTLER_LIMIT_KEY, fn);
        const ttl = Reflect.getMetadata(THROTTLER_TTL_KEY, fn);
        expect(limit, 'throttle limit metadata present').toBeDefined();
        expect(ttl, 'throttle ttl metadata present').toBeDefined();
      });
    });
  }
});
