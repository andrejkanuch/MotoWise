import { z } from 'zod';

export const ArticleSectionSchema = z.object({ heading: z.string(), body: z.string() });
export type ArticleSection = z.infer<typeof ArticleSectionSchema>;

export const ArticleContentSchema = z.object({
  title: z.string(),
  slug: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  category: z.enum([
    'engine',
    'brakes',
    'electrical',
    'suspension',
    'drivetrain',
    'tires',
    'fuel',
    'general',
  ]),
  sections: z.array(ArticleSectionSchema),
  keyTakeaways: z.array(z.string()),
  relatedTopics: z.array(z.string()),
  quizSeed: z.string().optional(),
});
export type ArticleContent = z.infer<typeof ArticleContentSchema>;
