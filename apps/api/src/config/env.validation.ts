import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),
  REVENUECAT_WEBHOOK_SECRET: z.string().min(1).optional(),
  REVENUECAT_SECRET_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  GRAPHQL_PLAYGROUND: z.string().optional(),
  THROTTLE_TTL: z.string().default('60'),
  THROTTLE_LIMIT: z.string().default('100'),
  THROTTLE_AI_LIMIT: z.string().default('10'),
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;
