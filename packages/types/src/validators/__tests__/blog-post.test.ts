import { describe, expect, it } from 'vitest';
import { BlogPostStatus, BlogPostType } from '../../constants/enums';
import { CreateBlogPostInputSchema, UpdateBlogPostInputSchema } from '../blog-post';

const id = '6fb4b88f-c0eb-4bb2-b767-9f45b00c53f2';

const minimalCreate = {
  type: BlogPostType.GUIDE,
  slug: 'winter-storage',
  typeData: { type: BlogPostType.GUIDE },
  translations: [{ locale: 'en', title: 'Winter storage' }],
};

describe('CreateBlogPostInputSchema', () => {
  it('fills the create-time defaults', () => {
    expect(CreateBlogPostInputSchema.parse(minimalCreate)).toMatchObject({
      status: BlogPostStatus.DRAFT,
      specData: false,
      isSafetyCritical: false,
      categoryIds: [],
      keywordIds: [],
    });
  });

  it('requires scheduledFor when status is scheduled', () => {
    const scheduled = { ...minimalCreate, status: BlogPostStatus.SCHEDULED };
    const result = CreateBlogPostInputSchema.safeParse(scheduled);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scheduledFor']);
    expect(
      CreateBlogPostInputSchema.safeParse({ ...scheduled, scheduledFor: '2026-12-01T09:00:00Z' })
        .success,
    ).toBe(true);
  });
});

describe('UpdateBlogPostInputSchema', () => {
  // zod 4 runs an inner .default() under .partial(); an omitted field must stay
  // absent so BlogService.update does not overwrite it.
  it('leaves omitted fields absent instead of filling create-time defaults', () => {
    expect(UpdateBlogPostInputSchema.parse({ id })).toEqual({ id });
  });

  it('passes only the fields a partial update sends', () => {
    expect(UpdateBlogPostInputSchema.parse({ id, coverAlt: 'Alps' })).toEqual({
      id,
      coverAlt: 'Alps',
    });
  });

  it('keeps explicit values for the fields that have create-time defaults', () => {
    const input = {
      id,
      status: BlogPostStatus.PUBLISHED,
      specData: true,
      isSafetyCritical: true,
      categoryIds: [],
      keywordIds: [id],
    };
    expect(UpdateBlogPostInputSchema.parse(input)).toEqual(input);
  });
});
