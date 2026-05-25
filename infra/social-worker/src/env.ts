/**
 * Environment bindings for the MotoVault social Worker.
 *
 * All values are set via `wrangler secret put <NAME>` and injected at runtime.
 * Never commit actual values to the repo.
 */
export interface Env {
  // Meta Graph API
  META_API_KEY: string;
  META_PAGE_ID: string;
  META_IG_USER_ID: string;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // AI providers
  GOOGLE_AI_STUDIO_KEY: string;
  OPENAI_API_KEY: string;

  // HTTP auth for /publish-post, /publish-story, /generate-image, /fill-queue
  WORKER_AUTH_KEY: string;

  // KV namespace for async job state (/publish-now fire-and-forget)
  JOBS: KVNamespace;
}
