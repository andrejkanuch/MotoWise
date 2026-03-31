import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const isProduction = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  enableLogs: true,
  tracesSampleRate: isProduction ? 0.2 : 1.0,
  profileSessionSampleRate: isProduction ? 0.2 : 1.0,
  profileLifecycle: 'trace',
  sendDefaultPii: false,
  enabled: isProduction,
  beforeSend(event) {
    // Scrub sensitive headers to prevent leaking JWTs, cookies, API keys
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete (event.request.headers as Record<string, unknown>)['x-api-key'];
    }
    return event;
  },
});
