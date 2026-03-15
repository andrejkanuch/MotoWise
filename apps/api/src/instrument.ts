import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  enableLogs: true,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profileSessionSampleRate: 1.0,
  profileLifecycle: 'trace',
  sendDefaultPii: true,
  enabled: process.env.NODE_ENV === 'production',
});
