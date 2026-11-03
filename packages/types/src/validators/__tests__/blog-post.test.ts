import { describe, expect, it } from 'vitest';
import { BlogPostStatus } from '../../constants/enums';
import { UpdateBlogPostInputSchema } from '../blog-post';

const id = '6fb4b88f-c0eb-4bb2-b767-9f45b00c53f2';

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
