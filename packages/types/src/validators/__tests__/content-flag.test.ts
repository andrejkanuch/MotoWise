import { describe, expect, it } from 'vitest';
import { CreateContentFlagSchema } from '../content-flag';

const validFlag = {
  articleId: '550e8400-e29b-41d4-a716-446655440000',
  comment: 'This section contains inaccurate information about torque specs.',
};

describe('CreateContentFlagSchema', () => {
  describe('happy path', () => {
    it('accepts a valid content flag', () => {
      const result = CreateContentFlagSchema.safeParse(validFlag);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.articleId).toBe(validFlag.articleId);
        expect(result.data.comment).toBe(validFlag.comment);
      }
    });

    it('accepts with optional sectionReference', () => {
      const result = CreateContentFlagSchema.safeParse({
        ...validFlag,
        sectionReference: 'Section 3: Torque Values',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sectionReference).toBe('Section 3: Torque Values');
      }
    });
  });

  describe('missing required fields', () => {
    it('rejects missing articleId', () => {
      const result = CreateContentFlagSchema.safeParse({ comment: 'Some comment' });
      expect(result.success).toBe(false);
    });

    it('rejects missing comment', () => {
      const result = CreateContentFlagSchema.safeParse({ articleId: validFlag.articleId });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid enum/format', () => {
    it('rejects non-UUID articleId', () => {
      const result = CreateContentFlagSchema.safeParse({ ...validFlag, articleId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects malformed UUID articleId', () => {
      const result = CreateContentFlagSchema.safeParse({
        ...validFlag,
        articleId: '550e8400-e29b-41d4-a716',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('rejects empty comment', () => {
      const result = CreateContentFlagSchema.safeParse({ ...validFlag, comment: '' });
      expect(result.success).toBe(false);
    });

    it('accepts comment with 1 character', () => {
      const result = CreateContentFlagSchema.safeParse({ ...validFlag, comment: 'X' });
      expect(result.success).toBe(true);
    });

    it('accepts comment at max length (1000 chars)', () => {
      const result = CreateContentFlagSchema.safeParse({ ...validFlag, comment: 'A'.repeat(1000) });
      expect(result.success).toBe(true);
    });

    it('rejects comment exceeding max length (1001 chars)', () => {
      const result = CreateContentFlagSchema.safeParse({ ...validFlag, comment: 'A'.repeat(1001) });
      expect(result.success).toBe(false);
    });
  });

  describe('default/optional behavior', () => {
    it('sectionReference is undefined when omitted', () => {
      const result = CreateContentFlagSchema.safeParse(validFlag);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sectionReference).toBeUndefined();
      }
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown fields', () => {
      const result = CreateContentFlagSchema.safeParse({ ...validFlag, status: 'pending' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('status');
      }
    });
  });
});
