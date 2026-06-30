import { z } from 'zod';

/** Treat empty strings as undefined so optional env vars work correctly */
const optionalString = z
  .string()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined));
const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

export const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  // AI model-insights (onboarding Reveal known-issues card). Gemini is the
  // primary provider, OpenAI the fallback; all optional — the Reveal degrades
  // to factual cards and never blocks when AI is absent/slow.
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  AI_INSIGHTS_ENABLED: optionalString,
  AI_INSIGHTS_TIMEOUT_MS: optionalString,
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),
  REVENUECAT_WEBHOOK_SECRET: optionalString,
  REVENUECAT_SECRET_API_KEY: optionalString,
  // MOT-278: shared secret for the maintenance-due push trigger endpoint. The
  // endpoint fails closed when unset; the scheduler (U9) sends it as a header.
  MAINTENANCE_PUSH_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  GRAPHQL_PLAYGROUND: z.string().optional(),
  SHARE_BASE_URL: optionalString,
  THROTTLE_TTL: z.string().default('60'),
  THROTTLE_LIMIT: z.string().default('100'),
  THROTTLE_AI_LIMIT: z.string().default('10'),
  SENTRY_DSN: z.string().url().optional(),

  // Entitlements
  ENTITLEMENTS_ENFORCED: z.string().default('false'),

  // Meta Conversions API
  META_DATASET_ID: optionalString,
  META_ACCESS_TOKEN: optionalString,
});

export type Env = z.infer<typeof envSchema>;
