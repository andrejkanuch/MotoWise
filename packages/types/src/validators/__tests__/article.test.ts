import { describe, expect, it } from 'vitest';
import { ArticleContentSchema, ArticleSectionSchema } from '../article';

const validSection = { heading: 'Introduction', body: 'Some body text.' };

const validArticle = {
  title: 'How to Change Oil',
  slug: 'how-to-change-oil',
  difficulty: 'beginner',
  category: 'engine',
  sections: [validSection],
  keyTakeaways: ['Use the right oil weight'],
  relatedTopics: ['oil-filter'],
};

describe('ArticleSectionSchema', () => {
  it('accepts a valid section', () => {
    const result = ArticleSectionSchema.safeParse(validSection);
    expect(result.success).toBe(true);
  });

  it('rejects missing heading', () => {
    const result = ArticleSectionSchema.safeParse({ body: 'text' });
    expect(result.success).toBe(false);
  });

  it('rejects missing body', () => {
    const result = ArticleSectionSchema.safeParse({ heading: 'H' });
    expect(result.success).toBe(false);
  });

  it('strips unknown fields', () => {
    const result = ArticleSectionSchema.safeParse({ ...validSection, extra: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('extra');
    }
  });
});

describe('ArticleContentSchema', () => {
  describe('happy path', () => {
    it('accepts a valid article', () => {
      const result = ArticleContentSchema.safeParse(validArticle);
      expect(result.success).toBe(true);
    });

    it('accepts all difficulty levels', () => {
      for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
        const result = ArticleContentSchema.safeParse({ ...validArticle, difficulty });
        expect(result.success).toBe(true);
      }
    });

    it('accepts all category values', () => {
      const categories = [
        'engine',
        'brakes',
        'electrical',
        'suspension',
        'drivetrain',
        'tires',
        'fuel',
        'general',
      ];
      for (const category of categories) {
        const result = ArticleContentSchema.safeParse({ ...validArticle, category });
        expect(result.success).toBe(true);
      }
    });

    it('accepts with optional quizSeed', () => {
      const result = ArticleContentSchema.safeParse({ ...validArticle, quizSeed: 'seed-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quizSeed).toBe('seed-123');
      }
    });
  });

  describe('missing required fields', () => {
    const requiredFields = [
      'title',
      'slug',
      'difficulty',
      'category',
      'sections',
      'keyTakeaways',
      'relatedTopics',
    ];

    for (const field of requiredFields) {
      it(`rejects missing ${field}`, () => {
        const input = { ...validArticle };
        delete (input as Record<string, unknown>)[field];
        const result = ArticleContentSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    }
  });

  describe('invalid enum/format', () => {
    it('rejects invalid difficulty', () => {
      const result = ArticleContentSchema.safeParse({ ...validArticle, difficulty: 'expert' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid category', () => {
      const result = ArticleContentSchema.safeParse({ ...validArticle, category: 'wheels' });
      expect(result.success).toBe(false);
    });
  });

  describe('boundary values', () => {
    it('accepts empty arrays for sections, keyTakeaways, relatedTopics', () => {
      const result = ArticleContentSchema.safeParse({
        ...validArticle,
        sections: [],
        keyTakeaways: [],
        relatedTopics: [],
      });
      expect(result.success).toBe(true);
    });

    it('accepts multiple sections', () => {
      const result = ArticleContentSchema.safeParse({
        ...validArticle,
        sections: [validSection, { heading: 'Part 2', body: 'More text' }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sections).toHaveLength(2);
      }
    });
  });

  describe('default/optional behavior', () => {
    it('quizSeed defaults to undefined when omitted', () => {
      const result = ArticleContentSchema.safeParse(validArticle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quizSeed).toBeUndefined();
      }
    });
  });

  describe('unknown fields stripped', () => {
    it('strips unknown top-level fields', () => {
      const result = ArticleContentSchema.safeParse({ ...validArticle, foo: 'bar' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('foo');
      }
    });
  });
});
