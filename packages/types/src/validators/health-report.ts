import { z } from 'zod';

export const GenerateHealthReportInputSchema = z.object({
  bikeId: z.string().uuid(),
});
export type GenerateHealthReportInput = z.infer<typeof GenerateHealthReportInputSchema>;
