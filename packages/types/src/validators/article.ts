import { z } from 'zod';
import { ArticleCategory, ArticleDifficulty } from '../constants/enums';

const difficulties = Object.values(ArticleDifficulty) as [string, ...string[]];
const categories = Object.values(ArticleCategory) as [string, ...string[]];

export const ArticleSectionSchema = z.object({ heading: z.string(), body: z.string() });
export type ArticleSection = z.infer<typeof ArticleSectionSchema>;

export const ArticleContentSchema = z.object({
  title: z.string(),
  slug: z.string(),
  difficulty: z.enum(difficulties),
  category: z.enum(categories),
  sections: z.array(ArticleSectionSchema),
  keyTakeaways: z.array(z.string()),
  relatedTopics: z.array(z.string()),
  keywords: z.array(z.string()).optional(),
  quizSeed: z.string().optional(),
});
export type ArticleContent = z.infer<typeof ArticleContentSchema>;

export const GenerateArticleSchema = z.object({
  topic: z.string().min(3).max(200),
  category: z.enum(categories).optional(),
  difficulty: z.enum(difficulties).optional(),
});
export type GenerateArticle = z.infer<typeof GenerateArticleSchema>;
