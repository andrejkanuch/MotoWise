import { MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '@motovault/types';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Room for the GraphQL query text and the other fields around the photo. */
const GRAPHQL_ENVELOPE_BYTES = 64 * 1024;

/**
 * SubmitDiagnostic carries the photo inline as base64. Express's default JSON
 * limit is 100 KB, which rejected every photo with a 413 before the resolver's
 * own MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH check could run (Sentry
 * MOTO-VAULT-NODE-NESTJS-D / MOTO-VAULT-REACT-NATIVE-30). Derive the body limit
 * from that cap so the two cannot drift apart again.
 */
export const JSON_BODY_LIMIT_BYTES = MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH + GRAPHQL_ENVELOPE_BYTES;

/** Call before the app initialises, so it replaces Nest's default JSON parser. */
export function configureBodyParser(app: NestExpressApplication): void {
  // biome-ignore lint/correctness/useHookAtTopLevel: Nest's useBodyParser, not a React hook
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT_BYTES });
}
