import { z } from 'zod';

export const revenueCatEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  app_user_id: z.string().uuid(),
  product_id: z.string().optional(),
  entitlement_ids: z.array(z.string()).optional(),
  period_type: z.string().optional(),
  expiration_at_ms: z.number().optional(),
  purchased_at_ms: z.number().optional(),
  environment: z.string().optional(),
  store: z.string().optional(),
});

export const revenueCatWebhookPayloadSchema = z.object({
  api_version: z.string(),
  event: revenueCatEventSchema,
});

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;
export type RevenueCatWebhookPayload = z.infer<typeof revenueCatWebhookPayloadSchema>;
