import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const dummyMetadata = { type: 'body' as const, metatype: undefined, data: undefined };

  it('should return result.data for valid input', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const pipe = new ZodValidationPipe(schema);

    const result = pipe.transform({ name: 'Andrej', age: 25 }, dummyMetadata);

    expect(result).toEqual({ name: 'Andrej', age: 25 });
  });

  it('should throw BadRequestException with flattened errors for invalid input', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ name: 123, age: 'not-a-number' }, dummyMetadata)).toThrow(
      BadRequestException,
    );

    try {
      pipe.transform({ name: 123, age: 'not-a-number' }, dummyMetadata);
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse();
      // BadRequestException wraps the flattened Zod errors as the response
      expect(response).toHaveProperty('fieldErrors');
    }
  });

  it('should pass through null input (returns null)', () => {
    const schema = z.object({ name: z.string() });
    const pipe = new ZodValidationPipe(schema);

    const result = pipe.transform(null, dummyMetadata);

    expect(result).toBeNull();
  });

  it('should pass through undefined input (returns undefined)', () => {
    const schema = z.object({ name: z.string() });
    const pipe = new ZodValidationPipe(schema);

    const result = pipe.transform(undefined, dummyMetadata);

    expect(result).toBeUndefined();
  });

  it('should apply schema defaults via .default()', () => {
    const schema = z.object({
      name: z.string(),
      role: z.string().default('user'),
      active: z.boolean().default(true),
    });
    const pipe = new ZodValidationPipe(schema);

    const result = pipe.transform({ name: 'Andrej' }, dummyMetadata);

    expect(result).toEqual({ name: 'Andrej', role: 'user', active: true });
  });

  it('should strip unknown keys when schema uses .strict() or default behavior', () => {
    const schema = z.object({ name: z.string() });
    const pipe = new ZodValidationPipe(schema);

    // Zod strips unknown keys by default
    const result = pipe.transform({ name: 'Andrej', extra: 'removed' }, dummyMetadata);

    expect(result).toEqual({ name: 'Andrej' });
  });
});
