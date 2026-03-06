import { z } from 'zod';

export const DiagnosticIssueSchema = z.object({
  description: z.string(),
  probability: z.number().min(0).max(1),
});
export type DiagnosticIssue = z.infer<typeof DiagnosticIssueSchema>;

export const DiagnosticResultSchema = z.object({
  part: z.string(),
  issues: z.array(DiagnosticIssueSchema),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  toolsNeeded: z.array(z.string()),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'professional']),
  nextSteps: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  relatedArticleId: z.string().uuid().nullable(),
});
export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export const CreateDiagnosticSchema = z.object({
  motorcycleId: z.string().uuid(),
  wizardAnswers: z.record(z.string()).optional(),
  dataSharingOptedIn: z.boolean().default(false),
});
export type CreateDiagnostic = z.infer<typeof CreateDiagnosticSchema>;
