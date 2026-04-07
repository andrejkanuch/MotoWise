import { z } from 'zod';

export const AiRideSummaryResponseSchema = z.object({
  summaryText: z.string().min(1).max(2000),
});
export type AiRideSummaryResponse = z.infer<typeof AiRideSummaryResponseSchema>;
