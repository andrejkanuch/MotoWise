import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const testSchema = z.object({
  title: z.string().min(1),
  difficulty: z.enum(['beginner', 'advanced']),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(testSchema);
  const metadata = { type: 'body' as const, metatype: undefined, data: undefined };

  it('should pass and return parsed data for valid input', () => {
    const input = { title: 'Clutch Control', difficulty: 'beginner' };
    const result = pipe.transform(input, metadata);

    expect(result).toEqual({ title: 'Clutch Control', difficulty: 'beginner' });
  });

  it('should throw BadRequestException for invalid input', () => {
    const input = { title: 123, difficulty: 'expert' };

    expect(() => pipe.transform(input, metadata)).toThrow(BadRequestException);
  });

  it('should strip unknown fields', () => {
    const input = { title: 'Cornering', difficulty: 'advanced', extra: 'should be removed' };
    const result = pipe.transform(input, metadata);

    expect(result).toEqual({ title: 'Cornering', difficulty: 'advanced' });
    expect(result).not.toHaveProperty('extra');
  });

  it('should reject empty string for min(1) field', () => {
    const input = { title: '', difficulty: 'beginner' };

    expect(() => pipe.transform(input, metadata)).toThrow(BadRequestException);
  });
});
