import { z } from 'zod';
import { AssistantMessageRoleSchema } from './trip';

export const AskTripAssistantMessageSchema = z.object({
  role: AssistantMessageRoleSchema,
  content: z.string().min(1).max(4000),
});
export type AskTripAssistantMessage = z.infer<typeof AskTripAssistantMessageSchema>;

export const AskTripAssistantInputSchema = z.object({
  tripId: z.string().uuid(),
  question: z.string().trim().min(1).max(1000),
  history: z.array(AskTripAssistantMessageSchema).max(20).optional(),
});
export type AskTripAssistantInput = z.infer<typeof AskTripAssistantInputSchema>;
