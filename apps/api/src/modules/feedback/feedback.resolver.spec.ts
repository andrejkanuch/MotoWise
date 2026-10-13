import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { THROTTLE_PRESETS } from '../../config/constants';
import { FeedbackResolver } from './feedback.resolver';

describe('FeedbackResolver.sendFeedback throttle', () => {
  const method = FeedbackResolver.prototype.sendFeedback;

  it('is guarded by GqlThrottlerGuard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, method) ?? []) as Array<{ name?: string }>;
    expect(guards.map((g) => g?.name)).toContain(GqlThrottlerGuard.name);
  });

  it('uses 5 sends per hour', () => {
    expect(THROTTLE_PRESETS.FEEDBACK).toEqual({ limit: 5, ttl: 3_600_000 });
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', method)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', method)).toBe(3_600_000);
  });
});
