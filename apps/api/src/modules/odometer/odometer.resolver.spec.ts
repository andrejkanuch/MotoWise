import { LogOdometerReadingSchema, ODOMETER_FUTURE_TOLERANCE_MS } from '@motovault/types';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OdometerResolver } from './odometer.resolver';

const MOTORCYCLE_ID = '22222222-2222-4222-8222-222222222222';
const BODY_METADATA = { type: 'body' } as const;

describe('OdometerResolver auth guard audit', () => {
  const resolverPrototype = OdometerResolver.prototype as unknown as Record<string, unknown>;

  for (const method of ['odometerReadings', 'pendingRideDistance', 'logOdometerReading']) {
    it(`${method} should NOT be @Public()`, () => {
      expect(typeof resolverPrototype[method]).toBe('function');
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[method] as object)).not.toBe(
        true,
      );
    });
  }
});

describe('logOdometerReading input pipe', () => {
  const pipe = new ZodValidationPipe(LogOdometerReadingSchema);

  it('passes a valid reading through', () => {
    const input = { motorcycleId: MOTORCYCLE_ID, value: 39407 };
    expect(pipe.transform(input, BODY_METADATA)).toEqual(input);
  });

  it('rejects a negative value', () => {
    expect(() => pipe.transform({ motorcycleId: MOTORCYCLE_ID, value: -1 }, BODY_METADATA)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a recordedAt beyond the future tolerance', () => {
    const recordedAt = new Date(Date.now() + ODOMETER_FUTURE_TOLERANCE_MS + 60_000).toISOString();
    expect(() =>
      pipe.transform({ motorcycleId: MOTORCYCLE_ID, value: 39407, recordedAt }, BODY_METADATA),
    ).toThrow(BadRequestException);
  });
});
