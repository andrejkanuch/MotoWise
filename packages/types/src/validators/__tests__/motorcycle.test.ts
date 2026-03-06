import { describe, expect, it } from 'vitest';
import { MAX_MOTORCYCLE_YEAR, MIN_MOTORCYCLE_YEAR } from '../../constants/limits';
import { CreateMotorcycleSchema } from '../motorcycle';

const validMotorcycle = {
  make: 'Honda',
  model: 'CBR600RR',
  year: 2023,
};

describe('CreateMotorcycleSchema', () => {
  describe('happy path', () => {
    it('accepts a valid motorcycle', () => {
      const result = CreateMotorcycleSchema.safeParse(validMotorcycle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validMotorcycle);
      }
    });

    it('accepts with optional nickname', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        nickname: 'Red Rocket',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nickname).toBe('Red Rocket');
      }
    });
  });

  describe('missing required fields', () => {
    it('rejects missing make', () => {
      const { make, ...rest } = validMotorcycle;
      const result = CreateMotorcycleSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing model', () => {
      const { model, ...rest } = validMotorcycle;
      const result = CreateMotorcycleSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing year', () => {
      const { year, ...rest } = validMotorcycle;
      const result = CreateMotorcycleSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('invalid format', () => {
    it('rejects non-integer year', () => {
      const result = CreateMotorcycleSchema.safeParse({ ...validMotorcycle, year: 2023.5 });
      expect(result.success).toBe(false);
    });

    it('rejects string year', () => {
      const result = CreateMotorcycleSchema.safeParse({ ...validMotorcycle, year: '2023' });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('rejects make with empty string', () => {
      const result = CreateMotorcycleSchema.safeParse({ ...validMotorcycle, make: '' });
      expect(result.success).toBe(false);
    });

    it('rejects model with empty string', () => {
      const result = CreateMotorcycleSchema.safeParse({ ...validMotorcycle, model: '' });
      expect(result.success).toBe(false);
    });

    it('accepts make at max length (100 chars)', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        make: 'A'.repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it('rejects make exceeding max length (101 chars)', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        make: 'A'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('accepts model at max length (100 chars)', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        model: 'B'.repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it('rejects model exceeding max length (101 chars)', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        model: 'B'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('accepts nickname at max length (50 chars)', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        nickname: 'N'.repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it('rejects nickname exceeding max length (51 chars)', () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        nickname: 'N'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it(`accepts year at minimum (${MIN_MOTORCYCLE_YEAR})`, () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        year: MIN_MOTORCYCLE_YEAR,
      });
      expect(result.success).toBe(true);
    });

    it(`rejects year below minimum (${MIN_MOTORCYCLE_YEAR - 1})`, () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        year: MIN_MOTORCYCLE_YEAR - 1,
      });
      expect(result.success).toBe(false);
    });

    it(`accepts year at maximum (${MAX_MOTORCYCLE_YEAR})`, () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        year: MAX_MOTORCYCLE_YEAR,
      });
      expect(result.success).toBe(true);
    });

    it(`rejects year above maximum (${MAX_MOTORCYCLE_YEAR + 1})`, () => {
      const result = CreateMotorcycleSchema.safeParse({
        ...validMotorcycle,
        year: MAX_MOTORCYCLE_YEAR + 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('default/optional behavior', () => {
    it('nickname is undefined when omitted', () => {
      const result = CreateMotorcycleSchema.safeParse(validMotorcycle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nickname).toBeUndefined();
      }
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = CreateMotorcycleSchema.safeParse({ ...validMotorcycle, color: 'red' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('color');
      }
    });
  });
});
