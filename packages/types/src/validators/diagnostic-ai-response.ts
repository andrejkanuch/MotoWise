import { z } from 'zod';

/**
 * Schema for zodResponseFormat — used with OpenAI structured outputs.
 * NO .optional(), NO .refine(), NO .record() — only .nullable() and .describe().
 */
export const DiagnosticAiResultSchema = z.object({
  part: z.string().describe('The motorcycle part or component affected'),
  issues: z
    .array(
      z.object({
        description: z.string().describe('Description of the potential issue'),
        probability: z.number().describe('Probability of this issue between 0 and 1'),
      }),
    )
    .describe('List of potential issues with probabilities'),
  severity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('Overall severity of the diagnosed issue'),
  toolsNeeded: z.array(z.string()).describe('List of tools needed for repair'),
  difficulty: z
    .enum(['easy', 'moderate', 'hard', 'professional'])
    .describe('Difficulty level of the repair'),
  nextSteps: z.array(z.string()).describe('Recommended next steps for the user'),
  confidence: z.number().describe('Overall confidence in the diagnosis between 0 and 1'),
  relatedArticleId: z.string().nullable().describe('UUID of a related article, or null if none'),
});
export type DiagnosticAiResult = z.infer<typeof DiagnosticAiResultSchema>;
