import { z } from 'zod';

/**
 * RevenueCat webhook event. Only the fields the service acts on are typed;
 * `.passthrough()` keeps the rest so a redacted copy of the whole event can be
 * stored in `revenuecat_webhook_events.payload` for later forensics (trial
 * history, offer used, presented offering) without another schema change.
 * https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export const revenueCatEventSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    app_user_id: z.string(),
    original_app_user_id: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    product_id: z.string().optional(),
    new_product_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    period_type: z.string().optional(),
    is_trial_conversion: z.boolean().optional(),
    expiration_at_ms: z.number().nullable().optional(),
    purchased_at_ms: z.number().optional(),
    grace_period_expiration_at_ms: z.number().nullable().optional(),
    cancel_reason: z.string().optional(),
    expiration_reason: z.string().optional(),
    environment: z.string().optional(),
    store: z.string().optional(),
    price: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    // TRANSFER only — sent for the destination user.
    transferred_from: z.array(z.string()).optional(),
    transferred_to: z.array(z.string()).optional(),
    // PII-bearing ($ip, $idfa, $email…); stripped before persisting.
    subscriber_attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const revenueCatWebhookPayloadSchema = z.object({
  api_version: z.string().optional(),
  event: revenueCatEventSchema,
});

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;
export type RevenueCatWebhookPayload = z.infer<typeof revenueCatWebhookPayloadSchema>;
