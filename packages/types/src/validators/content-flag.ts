import { z } from 'zod';

export const CreateContentFlagSchema = z.object({
  articleId: z.string().uuid(),
  sectionReference: z.string().optional(),
  comment: z.string().min(1).max(1000),
});
export type CreateContentFlag = z.infer<typeof CreateContentFlagSchema>;
