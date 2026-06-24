import { z } from 'zod';
import { BLOG_LOCALES, BlogPostStatus, BlogPostType } from '../constants/enums';
import { BlogTypeDataSchema } from './blog-content-types';

/**
 * Blog CMS input/content schemas (plan U2). Shared between the NestJS admin DTOs
 * (U5) and the web admin editor (U9). Export both schema and inferred type.
 */

const types = Object.values(BlogPostType) as [string, ...string[]];
const statuses = Object.values(BlogPostStatus) as [string, ...string[]];

/** kebab-case slug, locale-invariant. */
export const BlogSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be kebab-case');

/**
 * cover_image is either an absolute http(s) URL or a root-relative asset path
 * (e.g. /images/blog/foo.webp). Bare/other schemes are rejected to close the
 * SSRF/open-redirect surface flagged in review.
 */
export const BlogCoverImageSchema = z
  .string()
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith('/'),
    'must be an https URL or a root-relative /images path',
  );

export const BlogFaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export type BlogFaqItem = z.infer<typeof BlogFaqItemSchema>;

/** One locale's translatable content for a post. */
export const BlogTranslationInputSchema = z.object({
  locale: z.enum(BLOG_LOCALES),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(500).optional(),
  seoTitle: z.string().max(300).optional(),
  seoDescription: z.string().max(500).optional(),
  bodyRaw: z.string().default(''),
  faq: z.array(BlogFaqItemSchema).default([]),
  readingTime: z.string().optional(),
});
export type BlogTranslationInput = z.infer<typeof BlogTranslationInputSchema>;

export const CreateBlogPostInputSchema = z.object({
  type: z.enum(types),
  slug: BlogSlugSchema,
  status: z.enum(statuses).default(BlogPostStatus.DRAFT),
  author: z.string().max(120).optional(),
  coverImage: BlogCoverImageSchema.optional(),
  coverAlt: z.string().max(300).optional(),
  specData: z.boolean().default(false),
  isSafetyCritical: z.boolean().default(false),
  // Required when status === 'scheduled' (mirrors the DB CHECK).
  scheduledFor: z.string().datetime().optional(),
  typeData: BlogTypeDataSchema,
  translations: z.array(BlogTranslationInputSchema).min(1),
  categoryIds: z.array(z.string().uuid()).default([]),
  keywordIds: z.array(z.string().uuid()).default([]),
});
export type CreateBlogPostInput = z.infer<typeof CreateBlogPostInputSchema>;

export const UpdateBlogPostInputSchema = CreateBlogPostInputSchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateBlogPostInput = z.infer<typeof UpdateBlogPostInputSchema>;

export const ScheduleBlogPostInputSchema = z.object({
  id: z.string().uuid(),
  scheduledFor: z.string().datetime(),
});
export type ScheduleBlogPostInput = z.infer<typeof ScheduleBlogPostInputSchema>;

/** Create a category from a free-text name; the service derives the slug (plan U9 picker). */
export const CreateBlogCategoryInputSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().uuid().optional(),
});
export type CreateBlogCategoryInput = z.infer<typeof CreateBlogCategoryInputSchema>;

export const CreateBlogKeywordInputSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateBlogKeywordInput = z.infer<typeof CreateBlogKeywordInputSchema>;
