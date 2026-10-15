import './instrument';

import { MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '@motovault/types';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Room for the GraphQL query text and the other fields around the photo. */
const GRAPHQL_ENVELOPE_BYTES = 64 * 1024;

/**
 * SubmitDiagnostic carries the photo inline as base64. Express's default JSON
 * limit is 100 KB, which rejected every photo with a 413 before the resolver's
 * own MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH check could run (Sentry
 * MOTO-VAULT-NODE-NESTJS-D / MOTO-VAULT-REACT-NATIVE-30). Derive the body limit
 * from that cap so the two cannot drift apart again.
 */
const JSON_BODY_LIMIT_BYTES = MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH + GRAPHQL_ENVELOPE_BYTES;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // biome-ignore lint/correctness/useHookAtTopLevel: Nest's useBodyParser, not a React hook
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT_BYTES });

  // Graceful shutdown hooks for SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Trust proxy for correct client IP behind Render's load balancer
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? [
      'http://localhost:8081',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/graphql`);
}
bootstrap();
