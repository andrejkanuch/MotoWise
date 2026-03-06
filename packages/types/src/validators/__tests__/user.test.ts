import { describe, expect, it } from 'vitest';
import { UpdateUserSchema } from '../user';

describe('UpdateUserSchema', () => {
  describe('happy path', () => {
    it('accepts valid full update', () => {
      const result = UpdateUserSchema.safeParse({
        fullName: 'John Doe',
        preferences: { theme: 'dark', notifications: true },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('John Doe');
        expect(result.data.preferences).toEqual({ theme: 'dark', notifications: true });
      }
    });

    it('accepts only fullName', () => {
      const result = UpdateUserSchema.safeParse({ fullName: 'Jane' });
      expect(result.success).toBe(true);
    });

    it('accepts only preferences', () => {
      const result = UpdateUserSchema.safeParse({ preferences: { lang: 'en' } });
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('accepts empty object (all fields optional)', () => {
      const result = UpdateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('invalid format', () => {
    it('rejects non-string fullName', () => {
      const result = UpdateUserSchema.safeParse({ fullName: 123 });
      expect(result.success).toBe(false);
    });

    it('rejects non-object preferences', () => {
      const result = UpdateUserSchema.safeParse({ preferences: 'not-an-object' });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('rejects fullName with empty string', () => {
      const result = UpdateUserSchema.safeParse({ fullName: '' });
      expect(result.success).toBe(false);
    });

    it('accepts fullName with 1 character', () => {
      const result = UpdateUserSchema.safeParse({ fullName: 'A' });
      expect(result.success).toBe(true);
    });

    it('accepts fullName at max length (200 chars)', () => {
      const result = UpdateUserSchema.safeParse({ fullName: 'A'.repeat(200) });
      expect(result.success).toBe(true);
    });

    it('rejects fullName exceeding max length (201 chars)', () => {
      const result = UpdateUserSchema.safeParse({ fullName: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('accepts empty preferences record', () => {
      const result = UpdateUserSchema.safeParse({ preferences: {} });
      expect(result.success).toBe(true);
    });
  });

  describe('default/optional behavior', () => {
    it('omitted fields are undefined', () => {
      const result = UpdateUserSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBeUndefined();
        expect(result.data.preferences).toBeUndefined();
      }
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = UpdateUserSchema.safeParse({ fullName: 'Test', email: 'x@y.com' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('email');
      }
    });
  });
});
