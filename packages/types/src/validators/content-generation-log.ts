import { z } from 'zod';

export const ContentGenerationLogSchema = z.object({
  contentType: z.enum(['article', 'quiz', 'diagnostic_response']),
  contentId: z.string().uuid().optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  model: z.string().optional(),
  costCents: z.number().int().min(0).optional(),
  status: z.enum(['success', 'failed', 'rate_limited']).default('success'),
  errorMessage: z.string().optional(),
});

export type ContentGenerationLog = z.infer<typeof ContentGenerationLogSchema>;
