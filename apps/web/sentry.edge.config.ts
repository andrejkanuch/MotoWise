// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://a3cf72113ed0793fa895a40f6baa3ab1@o4510167517954048.ingest.us.sentry.io/4511299447291904',

  // Never report from a developer's machine. MOTOVAULT-WEB-Z was 16 "TypeError:
  // fetch failed" events that looked like a production incident on
  // /[locale]/explore/[country] but were `ECONNREFUSED 127.0.0.1:4000` from
  // localhost:3000 via curl — a local dev session with the API not running
  // (PR #177's own verification pass). Dev noise in the production project
  // costs real triage time, so gate on NODE_ENV rather than filtering later.
  enabled: process.env.NODE_ENV === 'production',

  // Distinguish preview from production instead of lumping both under "production".
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
